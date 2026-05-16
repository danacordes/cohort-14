import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { TICKET_DETAIL } from '../../graphql/tickets.js';

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useQuery(TICKET_DETAIL, {
    variables: { id },
    skip: !id,
  });

  const t = data?.ticket;

  function assigneeCell() {
    if (!t?.assignedTo) return 'Unassigned';
    return t.assignedTo.length > 16 ? `${t.assignedTo.slice(0, 12)}…` : t.assignedTo;
  }

  return (
    <Box sx={{ p: 4, maxWidth: 720 }}>
      <Button variant="text" sx={{ mb: 2 }} onClick={() => navigate('/tickets')}>
        ← Back to list
      </Button>

      {loading && <Typography variant="body2">Loading…</Typography>}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          You cannot view this ticket or it does not exist.
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
            <Typography variant="body2">{t.updatedAt}</Typography>
          </Paper>

          <Typography variant="subtitle2" gutterBottom>Description</Typography>
          <Paper variant="outlined" sx={{ p: 2, mb: 2, whiteSpace: 'pre-wrap' }}>
            <Typography variant="body2">{t.description || '—'}</Typography>
          </Paper>

          {t.resolutionSummary && (
            <>
              <Typography variant="subtitle2" gutterBottom>Resolution</Typography>
              <Paper variant="outlined" sx={{ p: 2, mb: 2, whiteSpace: 'pre-wrap' }}>
                <Typography variant="body2">{t.resolutionSummary}</Typography>
              </Paper>
            </>
          )}

          <Button component={RouterLink} to="/kb" variant="outlined">
            Browse knowledge base
          </Button>
        </>
      )}
    </Box>
  );
}
