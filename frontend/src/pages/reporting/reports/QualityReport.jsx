import { useState } from 'react';
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
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';

function pct(rate) {
  if (rate == null) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

function CsatRow({ response }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TableRow>
        <TableCell>{response.ticketId}</TableCell>
        <TableCell align="right">{response.rating}</TableCell>
        <TableCell>{response.submittedAt}</TableCell>
        <TableCell>
          {response.comment && (
            <IconButton size="small" onClick={() => setOpen((v) => !v)}>
              {open ? '▲' : '▼'}
            </IconButton>
          )}
        </TableCell>
      </TableRow>
      {response.comment && (
        <TableRow>
          <TableCell colSpan={4} sx={{ py: 0 }}>
            <Collapse in={open}>
              <Box p={1} bgcolor="action.hover" borderRadius={1} mb={1}>
                <Typography variant="body2">{response.comment}</Typography>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function QualityReport({ data, isAdmin }) {
  if (!data) return null;

  const {
    fcrRate,
    reopenRate,
    escalationRate,
    overallCsatScore,
    categoryBreakdown = [],
    csatResponses = [],
  } = data;

  return (
    <Box>
      <Grid container spacing={2} mb={3}>
        <Grid item xs={6} sm={3}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">FCR Rate</Typography>
            <Typography variant="h5" fontWeight={700}>{pct(fcrRate)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Reopen Rate</Typography>
            <Typography variant="h5" fontWeight={700}>{pct(reopenRate)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Escalation Rate</Typography>
            <Typography variant="h5" fontWeight={700}>{pct(escalationRate)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Overall CSAT</Typography>
            <Typography variant="h5" fontWeight={700}>
              {overallCsatScore != null ? overallCsatScore.toFixed(1) : '—'}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {categoryBreakdown.length > 0 && (
        <>
          <Typography variant="h6" fontWeight={600} mb={1}>Category Breakdown</Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">FCR</TableCell>
                  <TableCell align="right">Reopen</TableCell>
                  <TableCell align="right">Escalation</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categoryBreakdown.map((row) => (
                  <TableRow key={row.category}>
                    <TableCell>{row.category}</TableCell>
                    <TableCell align="right">{pct(row.fcrRate)}</TableCell>
                    <TableCell align="right">{pct(row.reopenRate)}</TableCell>
                    <TableCell align="right">{pct(row.escalationRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {isAdmin && (
        <>
          <Typography variant="h6" fontWeight={600} mb={1}>CSAT Responses</Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Ticket</TableCell>
                  <TableCell align="right">Rating</TableCell>
                  <TableCell>Submitted</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {csatResponses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">No responses</TableCell>
                  </TableRow>
                ) : (
                  csatResponses.map((r, i) => <CsatRow key={i} response={r} />)
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
