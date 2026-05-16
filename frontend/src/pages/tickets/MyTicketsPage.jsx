import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useSelector } from 'react-redux';
import SLAIndicator from '../../components/SLAIndicator.jsx';
import { TICKET_POLL_INTERVAL_MS } from '../../constants/ticketPolling.js';
import { MY_TICKETS } from '../../graphql/tickets.js';
import { selectRole } from '../../store/authSlice.js';

function AssigneeDisplay({ assignedTo }) {
  if (!assignedTo) return <Typography variant="body2" color="text.secondary">Unassigned</Typography>;
  return (
    <Typography variant="body2" fontFamily="monospace">
      {assignedTo.length > 12 ? `${assignedTo.slice(0, 8)}…` : assignedTo}
    </Typography>
  );
}

export default function MyTicketsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const role = useSelector(selectRole);
  const { data, loading, error } = useQuery(MY_TICKETS, {
    variables: {
      page: 1,
      pageSize: 25,
      sort: { field: 'created_at', direction: 'DESC' },
    },
    pollInterval: TICKET_POLL_INTERVAL_MS,
  });

  const pageTitle =
    role === 'user'
      ? 'My tickets'
      : 'Tickets';

  const pageSubtitle =
    role === 'user'
      ? 'Tickets you submitted. Only your tickets appear here.'
      : 'Tickets assigned to you — use the submission form to track issues you personally create.';

  const edges = data?.tickets?.edges ?? [];

  return (
    <Box sx={{ p: 4, maxWidth: 1100 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        {pageTitle}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {pageSubtitle}
      </Typography>

      {location.state?.deflectionRecorded && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Self-resolution recorded. No ticket was created.
        </Alert>
      )}

      {loading && <Typography variant="body2">Loading…</Typography>}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not load tickets.
        </Alert>
      )}

      {!loading && edges.length === 0 && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="body1" gutterBottom>
            No tickets to show yet.
          </Typography>
          <Typography component={RouterLink} to="/tickets/submit" color="primary">
            Submit your first ticket
          </Typography>
        </Paper>
      )}

      {!loading && edges.length > 0 && (
        <Paper variant="outlined" sx={{ overflow: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>SLA</TableCell>
                <TableCell>Assignee</TableCell>
                <TableCell>Updated</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {edges.map(({ node: t }) => (
                <TableRow
                  key={t.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/tickets/${t.id}`)}
                >
                  <TableCell>
                    <Typography
                      variant="body2"
                      component={RouterLink}
                      to={`/tickets/${t.id}`}
                      onClick={(e) => e.stopPropagation()}
                      color="primary"
                    >
                      #{t.publicNumber}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 280 }}>
                    <Typography variant="body2" noWrap>{t.title}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={t.status} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip label={t.priority} size="small" variant="outlined" {...(t.priority === 'CRITICAL' ? { color: 'error' } : {})} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <SLAIndicator dense {...t} />
                  </TableCell>
                  <TableCell>
                    <AssigneeDisplay assignedTo={t.assignedTo} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {t.updatedAt ?? t.createdAt}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
