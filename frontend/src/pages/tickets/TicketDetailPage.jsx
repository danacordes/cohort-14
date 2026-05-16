import { useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import AIInsightsPanel from '../../components/AIInsightsPanel.jsx';
import AuditLogView from '../../components/AuditLogView.jsx';
import SLAIndicator from '../../components/SLAIndicator.jsx';
import { TICKET_POLL_INTERVAL_MS } from '../../constants/ticketPolling.js';
import {
  ADD_COMMENT,
  CLOSE_TICKET,
  CONFIRM_RESOLUTION,
  REOPEN_TICKET,
  RESOLVE_TICKET,
  TICKET_COMMENTS,
  TICKET_DETAIL,
} from '../../graphql/tickets.js';
import { selectRole, selectUser } from '../../store/authSlice.js';

function shortAuthor(id) {
  if (!id) return '—';
  return id.length > 14 ? `${id.slice(0, 10)}…` : id;
}

function CommentBubble({ authorId, createdAt, body }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 1 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {shortAuthor(authorId)}
        {' · '}
        {createdAt}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>
        {body}
      </Typography>
    </Paper>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const role = useSelector(selectRole);
  const user = useSelector(selectUser);

  const [internalDraft, setInternalDraft] = useState('');
  const [externalDraft, setExternalDraft] = useState('');
  const [resolutionDraft, setResolutionDraft] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  const deskRole = role === 'agent' || role === 'admin';
  const backTarget = role === 'user' ? '/tickets' : '/desk/queue';

  const {
    data: ticketData,
    loading: ticketLoading,
    error: ticketError,
    refetch: refetchTicket,
  } = useQuery(TICKET_DETAIL, {
    variables: { id },
    skip: !id,
    pollInterval: TICKET_POLL_INTERVAL_MS,
  });

  const {
    data: commentsData,
    loading: commentsLoading,
    refetch: refetchComments,
  } = useQuery(TICKET_COMMENTS, {
    variables: { ticketId: id },
    skip: !id,
  });

  const [addComment] = useMutation(ADD_COMMENT);
  const [resolveTicket] = useMutation(RESOLVE_TICKET);
  const [confirmResolution] = useMutation(CONFIRM_RESOLUTION);
  const [closeTicket] = useMutation(CLOSE_TICKET);
  const [reopenTicket] = useMutation(REOPEN_TICKET);

  async function refreshAll() {
    await Promise.all([refetchTicket(), refetchComments()]);
  }

  const t = ticketData?.ticket;
  const comments = commentsData?.ticketComments ?? [];
  const externalComments = comments.filter((c) => !c.isInternal);
  const internalComments = comments.filter((c) => c.isInternal);

  const composerLocked = t?.status === 'CLOSED';
  const canResolve =
    deskRole &&
    t &&
    ['OPEN', 'IN_PROGRESS', 'PENDING_USER_RESPONSE'].includes(t.status);
  const canAgentCloseResolved = deskRole && t?.status === 'RESOLVED';
  const canSubmitterConfirm =
    role === 'user' &&
    t?.status === 'RESOLVED' &&
    user?.sub &&
    t.submitterRef === user.sub;

  async function handleAddComment(body, isInternal) {
    if (!id || !body.trim()) return;
    setActionError('');
    setBusy(true);
    try {
      await addComment({
        variables: {
          input: { ticketId: id, body: body.trim(), isInternal },
        },
      });
      if (isInternal) setInternalDraft('');
      else setExternalDraft('');
      await refreshAll();
    } catch (e) {
      setActionError(e.message ?? 'Could not post comment.');
    } finally {
      setBusy(false);
    }
  }

  async function handleResolve() {
    if (!id || !resolutionDraft.trim()) {
      setActionError('Resolution summary is required.');
      return;
    }
    setActionError('');
    setBusy(true);
    try {
      await resolveTicket({
        variables: { ticketId: id, resolutionSummary: resolutionDraft.trim() },
      });
      setResolutionDraft('');
      await refreshAll();
    } catch (e) {
      setActionError(e.message ?? 'Could not resolve ticket.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmResolution() {
    if (!id) return;
    setActionError('');
    setBusy(true);
    try {
      await confirmResolution({ variables: { ticketId: id } });
      await refreshAll();
    } catch (e) {
      setActionError(e.message ?? 'Could not confirm resolution.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCloseTicket() {
    if (!id) return;
    setActionError('');
    setBusy(true);
    try {
      await closeTicket({ variables: { ticketId: id } });
      await refreshAll();
    } catch (e) {
      setActionError(e.message ?? 'Could not close ticket.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReopen() {
    if (!id) return;
    setActionError('');
    setBusy(true);
    try {
      await reopenTicket({ variables: { id } });
      await refreshAll();
    } catch (e) {
      setActionError(e.message ?? 'Could not reopen ticket.');
    } finally {
      setBusy(false);
    }
  }

  function assigneeCell() {
    if (!t?.assignedTo) return 'Unassigned';
    return t.assignedTo.length > 16 ? `${t.assignedTo.slice(0, 12)}…` : t.assignedTo;
  }

  return (
    <Box sx={{ p: 4, maxWidth: 960 }}>
      <Button variant="text" sx={{ mb: 2 }} onClick={() => navigate(backTarget)}>
        ← Back
      </Button>

      {ticketLoading && <Typography variant="body2">Loading…</Typography>}
      {ticketError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          You cannot view this ticket or it does not exist.
        </Alert>
      )}

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError('')}>
          {actionError}
        </Alert>
      )}

      {t && (
        <>
          <Stack direction="row" alignItems="center" spacing={2} mb={2} flexWrap="wrap">
            <Typography variant="h4" fontWeight={700}>
              #{t.publicNumber}
            </Typography>
            <Chip label={t.status} size="small" variant="outlined" />
            <Chip label={t.priority} size="small" variant="outlined" />
          </Stack>

          <Typography variant="h6" gutterBottom>{t.title}</Typography>

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Assigned to
            </Typography>
            <Typography variant="body2" gutterBottom>{assigneeCell()}</Typography>
            {t.category && (
              <>
                <Typography variant="caption" color="text.secondary">
                  Category
                </Typography>
                <Typography variant="body2" gutterBottom>{t.category.name}</Typography>
              </>
            )}
            <Typography variant="caption" color="text.secondary">
              Last updated
            </Typography>
            <Typography variant="body2" gutterBottom>{t.updatedAt}</Typography>

            <Typography variant="caption" color="text.secondary">
              SLA
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <SLAIndicator {...t} />
            </Box>
          </Paper>

          {t.status === 'RESOLVED' && t.autoCloseAt && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Auto-close scheduled for{' '}
              <strong>{t.autoCloseAt}</strong>
              {' '}unless the submitter responds sooner.
            </Alert>
          )}

          <Typography variant="subtitle2" gutterBottom>Description</Typography>
          <Paper variant="outlined" sx={{ p: 2, mb: 2, whiteSpace: 'pre-wrap' }}>
            <Typography variant="body2">{t.description || '—'}</Typography>
          </Paper>

          {canResolve && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                Mark resolved
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                A resolution summary is required before moving to Resolved.
              </Typography>
              <TextField
                label="Resolution summary"
                value={resolutionDraft}
                onChange={(e) => setResolutionDraft(e.target.value)}
                fullWidth
                multiline
                minRows={3}
                sx={{ mb: 1 }}
              />
              <Button variant="contained" onClick={handleResolve} disabled={busy}>
                Resolve ticket
              </Button>
            </Paper>
          )}

          {(t.resolutionSummary || t.status === 'RESOLVED' || t.status === 'CLOSED') && (
            <>
              <Typography variant="subtitle2" gutterBottom>
                Resolution summary
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, mb: 2, whiteSpace: 'pre-wrap' }}>
                <Typography variant="body2">{t.resolutionSummary || '—'}</Typography>
              </Paper>
            </>
          )}

          {canSubmitterConfirm && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                Was your issue addressed?
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <Button variant="contained" color="success" onClick={handleConfirmResolution} disabled={busy}>
                  Confirm resolution
                </Button>
                <Button variant="outlined" color="warning" onClick={handleReopen} disabled={busy}>
                  Reopen ticket
                </Button>
              </Stack>
            </Paper>
          )}

          {canAgentCloseResolved && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                Close without submitter confirmation
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Moves the ticket to Closed immediately (still respects CSAT configuration).
              </Typography>
              <Button variant="contained" onClick={handleCloseTicket} disabled={busy}>
                Close ticket
              </Button>
            </Paper>
          )}

          {role === 'user' && user?.sub === t.submitterRef && t.status === 'CLOSED' && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Need this ticket reopened?
              </Typography>
              <Button variant="outlined" onClick={handleReopen} disabled={busy}>
                Reopen ticket
              </Button>
            </Paper>
          )}

          {deskRole && ['RESOLVED', 'CLOSED'].includes(t.status) && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                Reopen from desk
              </Typography>
              <Button variant="outlined" onClick={handleReopen} disabled={busy}>
                Reopen ticket
              </Button>
            </Paper>
          )}

          {deskRole && id && <AIInsightsPanel mode="detail" role={role} ticketId={id} />}

          {id && <AuditLogView entityType="Ticket" entityId={id} />}

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            Communication
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {deskRole
              ? 'Keep internal investigation notes separate from customer-visible messages.'
              : 'Messages here are visible to support agents working your ticket.'}
          </Typography>

          {commentsLoading && <Typography variant="body2">Loading comments…</Typography>}

          {deskRole && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                mb: 3,
                borderLeft: 4,
                borderColor: 'warning.main',
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} gutterBottom color="warning.dark">
                Internal notes (agents & admins only)
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Subscribers never see this thread. Notes cannot be edited after posting.
              </Typography>
              {internalComments.map((c) => (
                <CommentBubble key={c.id} {...c} />
              ))}
              {!internalComments.length && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  No internal notes yet.
                </Typography>
              )}
              <TextField
                label="Add internal note"
                value={internalDraft}
                onChange={(e) => setInternalDraft(e.target.value)}
                fullWidth
                multiline
                minRows={2}
                disabled={composerLocked || busy}
                sx={{ mb: 1 }}
              />
              <Button
                variant="contained"
                color="warning"
                disabled={composerLocked || busy || !internalDraft.trim()}
                onClick={() => handleAddComment(internalDraft, true)}
              >
                Post internal note
              </Button>
            </Paper>
          )}

          <Paper
            variant="outlined"
            sx={{
              p: 2,
              mb: 2,
              borderLeft: 4,
              borderColor: 'primary.main',
            }}
          >
            <Typography variant="subtitle2" fontWeight={700} gutterBottom color="primary.dark">
              {deskRole ? 'Messages with submitter' : 'Conversation'}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              {deskRole
                ? 'Everything here is visible to the person who submitted the ticket.'
                : 'Replies are sent to the assigned support agent.'}
            </Typography>
            {externalComments.map((c) => (
              <CommentBubble key={c.id} {...c} />
            ))}
            {!externalComments.length && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                No messages yet.
              </Typography>
            )}
            <TextField
              label={deskRole ? 'Message the submitter' : 'Reply'}
              value={externalDraft}
              onChange={(e) => setExternalDraft(e.target.value)}
              fullWidth
              multiline
              minRows={2}
              disabled={composerLocked || busy}
              sx={{ mb: 1 }}
            />
            <Button
              variant="contained"
              disabled={composerLocked || busy || !externalDraft.trim()}
              onClick={() => handleAddComment(externalDraft, false)}
            >
              Send
            </Button>
          </Paper>

          <Button component={RouterLink} to="/kb" variant="outlined">
            Browse knowledge base
          </Button>
        </>
      )}
    </Box>
  );
}
