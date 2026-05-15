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

export default function KBUsageReport({ data }) {
  if (!data) return null;

  const {
    topViewedArticles = [],
    deflectionCount,
    feedbackTrend = [],
    lowPerformingArticles = [],
  } = data;

  return (
    <Box>
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Self-Service Deflections
            </Typography>
            <Typography variant="h5" fontWeight={700}>{deflectionCount ?? '—'}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Typography variant="h6" fontWeight={600} mb={1}>Top Viewed Articles</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Article</TableCell>
              <TableCell align="right">Views</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {topViewedArticles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} align="center">No data</TableCell>
              </TableRow>
            ) : (
              topViewedArticles.map((a) => (
                <TableRow key={a.articleId}>
                  <TableCell>{a.title}</TableCell>
                  <TableCell align="right">{a.viewCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h6" fontWeight={600} mb={1}>Low Performing Articles</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Article</TableCell>
              <TableCell align="right">Views</TableCell>
              <TableCell align="right">Avg Rating</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lowPerformingArticles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center">No data</TableCell>
              </TableRow>
            ) : (
              lowPerformingArticles.map((a) => (
                <TableRow key={a.articleId}>
                  <TableCell>{a.title}</TableCell>
                  <TableCell align="right">{a.viewCount}</TableCell>
                  <TableCell align="right">
                    {a.avgRating != null ? a.avgRating.toFixed(1) : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {feedbackTrend.length > 0 && (
        <>
          <Typography variant="h6" fontWeight={600} mb={1}>Feedback Trend</Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Bucket</TableCell>
                  <TableCell align="right">Avg Rating</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {feedbackTrend.map((row) => (
                  <TableRow key={row.bucket}>
                    <TableCell>{row.bucket}</TableCell>
                    <TableCell align="right">
                      {row.avgRating != null ? row.avgRating.toFixed(1) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
