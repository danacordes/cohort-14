import { Link as RouterLink } from 'react-router-dom';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';

function fmt(minutes) {
  if (minutes == null) return '—';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

function pct(rate) {
  if (rate == null) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

export default function SLAPerformanceReport({ data }) {
  if (!data) return null;

  const {
    complianceRate,
    breachCount,
    atRiskCount,
    avgFirstResponseTime,
    avgResolutionTime,
    byPriority = [],
    breachedTickets = [],
  } = data;

  return (
    <Box>
      <Grid container spacing={2} mb={3}>
        <Grid item xs={6} sm={3}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Compliance Rate</Typography>
            <Typography variant="h5" fontWeight={700}>{pct(complianceRate)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Breaches</Typography>
            <Typography variant="h5" fontWeight={700}>{breachCount ?? '—'}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">At Risk</Typography>
            <Typography variant="h5" fontWeight={700}>{atRiskCount ?? '—'}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Avg First Response</Typography>
            <Typography variant="h5" fontWeight={700}>{fmt(avgFirstResponseTime)}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {byPriority.length > 0 && (
        <>
          <Typography variant="h6" fontWeight={600} mb={1}>By Priority</Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Priority</TableCell>
                  <TableCell align="right">Compliance</TableCell>
                  <TableCell align="right">Breaches</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {byPriority.map((row) => (
                  <TableRow key={row.priority}>
                    <TableCell>{row.priority}</TableCell>
                    <TableCell align="right">{pct(row.complianceRate)}</TableCell>
                    <TableCell align="right">{row.breachCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <Typography variant="h6" fontWeight={600} mb={1}>Breached Tickets</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Ticket</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Breached At</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {breachedTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center">No breached tickets</TableCell>
              </TableRow>
            ) : (
              breachedTickets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link component={RouterLink} to={`/tickets/${t.id}`}>
                      {t.title ?? t.id}
                    </Link>
                  </TableCell>
                  <TableCell>{t.priority}</TableCell>
                  <TableCell>{t.breachedAt}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
