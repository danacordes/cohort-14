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

export default function TicketVolumeReport({ data }) {
  if (!data) return null;

  const { totalSubmitted, totalClosed, backlogSize, trend = [] } = data;

  return (
    <Box>
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Total Submitted</Typography>
            <Typography variant="h5" fontWeight={700}>{totalSubmitted ?? '—'}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Total Closed</Typography>
            <Typography variant="h5" fontWeight={700}>{totalClosed ?? '—'}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Backlog Size</Typography>
            <Typography variant="h5" fontWeight={700}>{backlogSize ?? '—'}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Typography variant="h6" fontWeight={600} mb={1}>Trend</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Bucket</TableCell>
              <TableCell align="right">Created</TableCell>
              <TableCell align="right">Closed</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {trend.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center">No trend data</TableCell>
              </TableRow>
            ) : (
              trend.map((row) => (
                <TableRow key={row.bucket}>
                  <TableCell>{row.bucket}</TableCell>
                  <TableCell align="right">{row.created}</TableCell>
                  <TableCell align="right">{row.closed}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
