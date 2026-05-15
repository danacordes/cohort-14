import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { KB_ARTICLE, KB_FEEDBACK, RESTORE_KB_VERSION } from '../../graphql/kb.js';
import {
  setCurrentArticle,
  clearCurrentArticle,
  setLoading,
  selectCurrentArticle,
  selectKBLoading,
} from '../../store/kbSlice.js';
import { selectRole } from '../../store/authSlice.js';

const INACTIVE_STATUSES = ['Retired', 'Archived', 'Expired'];

function StatusBadge({ status }) {
  const colorMap = {
    Published: 'success',
    Draft: 'default',
    PendingReview: 'warning',
    Retired: 'error',
    Archived: 'default',
    Expired: 'error',
  };
  return <Chip label={status} color={colorMap[status] ?? 'default'} size="small" />;
}

function FeedbackWidget({ articleId, feedbackSummary, role }) {
  const [submitFeedback] = useMutation(KB_FEEDBACK);
  const [submitted, setSubmitted] = useState(!!feedbackSummary?.userRating);
  const [userRating, setUserRating] = useState(feedbackSummary?.userRating ?? null);

  const handleRate = async (rating) => {
    await submitFeedback({ variables: { articleId, rating } });
    setUserRating(rating);
    setSubmitted(true);
  };

  return (
    <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography variant="subtitle2" gutterBottom>
        Was this article helpful?
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <Button
          variant={userRating === 'helpful' ? 'contained' : 'outlined'}
          size="small"
          color="success"
          onClick={() => handleRate('helpful')}
          disabled={submitted}
        >
          👍 Helpful
        </Button>
        <Button
          variant={userRating === 'not_helpful' ? 'contained' : 'outlined'}
          size="small"
          color="error"
          onClick={() => handleRate('not_helpful')}
          disabled={submitted}
        >
          👎 Not helpful
        </Button>
        {(role === 'agent' || role === 'admin') && feedbackSummary && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            {feedbackSummary.helpfulCount} helpful · {feedbackSummary.notHelpfulCount} not helpful
          </Typography>
        )}
      </Stack>
      {submitted && (
        <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
          Thanks for your feedback.
        </Typography>
      )}
    </Box>
  );
}

function VersionHistoryPanel({ articleId, versions, role }) {
  const [restoreVersion, { loading }] = useMutation(RESTORE_KB_VERSION, {
    refetchQueries: [KB_ARTICLE],
  });
  const [confirmVersion, setConfirmVersion] = useState(null);

  const handleRestore = async () => {
    await restoreVersion({ variables: { articleId, versionId: confirmVersion.id } });
    setConfirmVersion(null);
  };

  if (!versions || versions.length === 0) return null;

  return (
    <Accordion sx={{ mt: 2 }}>
      <AccordionSummary expandIcon="▼">
        <Typography variant="subtitle2">Version History ({versions.length})</Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Version</TableCell>
              <TableCell>Editor</TableCell>
              <TableCell>Date</TableCell>
              {role === 'admin' && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {versions.map((v) => (
              <TableRow key={v.id}>
                <TableCell>v{v.versionNumber}</TableCell>
                <TableCell>{v.editor?.email ?? '—'}</TableCell>
                <TableCell>{new Date(v.createdAt).toLocaleString()}</TableCell>
                {role === 'admin' && (
                  <TableCell>
                    <Button size="small" onClick={() => setConfirmVersion(v)}>
                      Restore
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AccordionDetails>

      <Dialog open={!!confirmVersion} onClose={() => setConfirmVersion(null)}>
        <DialogTitle>Restore Version</DialogTitle>
        <DialogContent>
          <Typography>
            Restore v{confirmVersion?.versionNumber}? This will create a new version from that
            content without overwriting existing history.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmVersion(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleRestore} disabled={loading}>
            {loading ? <CircularProgress size={16} /> : 'Restore'}
          </Button>
        </DialogActions>
      </Dialog>
    </Accordion>
  );
}

export default function KBArticlePage() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const article = useSelector(selectCurrentArticle);
  const isLoading = useSelector(selectKBLoading('article'));
  const role = useSelector(selectRole);

  const { loading, error } = useQuery(KB_ARTICLE, {
    variables: { id },
    onCompleted(data) {
      dispatch(setCurrentArticle(data.kbArticle));
      dispatch(setLoading({ key: 'article', value: false }));
    },
    onError() {
      dispatch(setLoading({ key: 'article', value: false }));
    },
    fetchPolicy: 'cache-and-network',
  });

  useEffect(() => {
    dispatch(setLoading({ key: 'article', value: true }));
    return () => dispatch(clearCurrentArticle());
  }, [id, dispatch]);

  if (loading || isLoading) {
    return (
      <Box display="flex" justifyContent="center" mt={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !article) {
    return (
      <Box maxWidth={700} mx="auto" mt={6}>
        <Alert severity="error">Article not found or could not be loaded.</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/kb')}>Back to Search</Button>
      </Box>
    );
  }

  const isInactive = INACTIVE_STATUSES.includes(article.status);

  return (
    <Box maxWidth={900} mx="auto" p={3}>
      <Button size="small" onClick={() => navigate('/kb')} sx={{ mb: 2 }}>
        ← Back to Search
      </Button>

      {isInactive && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This article is <strong>{article.status}</strong> and is no longer active. Content may be
          outdated.
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center" mb={1}>
          <Typography variant="caption" color="text.secondary">{article.number}</Typography>
          <StatusBadge status={article.status} />
          {article.articleType && (
            <Chip label={article.articleType} size="small" variant="outlined" />
          )}
          {article.flaggedForReview && (
            <Tooltip title="Flagged for review due to low helpfulness ratings">
              <Chip label="Flagged" color="warning" size="small" />
            </Tooltip>
          )}
        </Stack>

        <Typography variant="h5" fontWeight={700} gutterBottom>
          {article.title}
        </Typography>

        <Stack direction="row" spacing={2} mb={2}>
          {article.category && (
            <Typography variant="caption" color="text.secondary">
              Category: {article.category.name}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            v{article.currentVersion} · Updated {new Date(article.updatedAt).toLocaleDateString()}
          </Typography>
          {article.author && (
            <Typography variant="caption" color="text.secondary">
              Author: {article.author.email}
            </Typography>
          )}
        </Stack>

        {article.tags?.length > 0 && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" mb={2}>
            {article.tags.map((tag) => (
              <Chip key={tag} label={tag} size="small" variant="outlined" />
            ))}
          </Stack>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
          {article.body}
        </Typography>

        {(role === 'agent' || role === 'admin') && (
          <Box mt={2} display="flex" gap={1}>
            <Button variant="outlined" size="small" onClick={() => navigate(`/kb/${id}/edit`)}>
              Edit
            </Button>
          </Box>
        )}

        <FeedbackWidget
          articleId={article.id}
          feedbackSummary={article.feedbackSummary}
          role={role}
        />

        {(role === 'agent' || role === 'admin') && (
          <VersionHistoryPanel
            articleId={article.id}
            versions={article.versionHistory}
            role={role}
          />
        )}
      </Paper>
    </Box>
  );
}
