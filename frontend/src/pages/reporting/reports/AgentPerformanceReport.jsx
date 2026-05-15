import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

function fmt(minutes) {
  if (minutes == null) return '—';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

export default function AgentPerformanceReport({ data }) {
  if (!data) return null;

  const agents = data.agents ?? [];

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} mb={1}>
        Agent Performance
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Agent</TableCell>
              <TableCell align="right">Resolved</TableCell>
              <TableCell align="right">Avg Handle Time</TableCell>
              <TableCell align="right">Avg MTTR</TableCell>
              <TableCell align="right">Avg CSAT</TableCell>
              <TableCell align="right">Open Tickets</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {agents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              agents.map((a) => (
                <TableRow key={a.agentId}>
                  <TableCell>{a.agentName}</TableCell>
                  <TableCell align="right">{a.ticketsResolved}</TableCell>
                  <TableCell align="right">{fmt(a.avgHandleTime)}</TableCell>
                  <TableCell align="right">{fmt(a.avgMttr)}</TableCell>
                  <TableCell align="right">
                    {a.avgCsatScore != null ? a.avgCsatScore.toFixed(1) : '—'}
                  </TableCell>
                  <TableCell align="right">{a.openTicketCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
