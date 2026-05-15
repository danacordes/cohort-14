import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useQuery } from '@apollo/client/react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { KB_ADMIN_METRICS } from '../../graphql/kb.js';
import {
  setAdminMetrics,
  setLoading,
  selectAdminMetrics,
  selectKBLoading,
} from '../../store/kbSlice.js';

const PERIOD_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

function MetricCard({ label, value }) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 160 }}>
      <CardContent>
        <Typography variant="h4" fontWeight={700}>{value ?? '—'}</Typography>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
      </CardContent>
    </Card>
  );
}

export default function KBAdminDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const metrics = useSelector(selectAdminMetrics);
  const isLoading = useSelector(selectKBLoading('metrics'));
  const [period, setPeriod] = useState('30d');

  const { loading } = useQuery(KB_ADMIN_METRICS, {
    variables: { period },
    onCompleted(data) {
      dispatch(setAdminMetrics(data.kbAdminMetrics));
      dispatch(setLoading({ key: 'metrics', value: false }));
    },
    onError() {
      dispatch(setLoading({ key: 'metrics', value: false }));
    },
    fetchPolicy: 'network-only',
  });

  const showLoading = loading || isLoading;

  return (
    <Box maxWidth={1100} mx="auto" p={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>KB Admin Dashboard</Typography>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Period</InputLabel>
          <Select
            label="Period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {PERIOD_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {showLoading ? (
        <Box display="flex" justifyContent="center" mt={6}>
          <CircularProgress />
        </Box>
      ) : !metrics ? (
        <Typography color="text.secondary">No metrics available.</Typography>
      ) : (
        <Stack spacing={4}>
          {/* Summary cards */}
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <MetricCard label="Self-service deflections" value={metrics.deflectionCount} />
            <MetricCard label="Top-viewed articles" value={metrics.topViewed?.length ?? 0} />
            <MetricCard label="Coverage gaps" value={metrics.coverageGaps?.length ?? 0} />
          </Stack>

          {/* Top viewed */}
          <Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Top Viewed Articles
            </Typography>
            <Paper variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell align="right">Views</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {metrics.topViewed?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Typography variant="body2" color="text.secondary">No data.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {metrics.topViewed?.map(({ article, viewCount }) => (
                    <TableRow
                      key={article.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/kb/${article.id}`)}
                    >
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {article.number}
                        </Typography>
                      </TableCell>
                      <TableCell>{article.title}</TableCell>
                      <TableCell align="right">{viewCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Box>

          {/* Feedback trends */}
          <Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Feedback Trends
            </Typography>
            <Paper variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell align="right">Helpful</TableCell>
                    <TableCell align="right">Not Helpful</TableCell>
                    <TableCell align="right">Net Score</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {metrics.feedbackTrends?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary">No feedback yet.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {metrics.feedbackTrends?.map(({ article, helpfulCount, notHelpfulCount, netScore }) => (
                    <TableRow
                      key={article.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/kb/${article.id}`)}
                    >
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {article.number}
                        </Typography>
                      </TableCell>
                      <TableCell>{article.title}</TableCell>
                      <TableCell align="right">{helpfulCount}</TableCell>
                      <TableCell align="right">{notHelpfulCount}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={netScore > 0 ? `+${netScore}` : netScore}
                          color={netScore >= 0 ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Box>

          {/* Coverage gaps */}
          <Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Coverage Gap Candidates
            </Typography>
            <Paper variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Reason</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {metrics.coverageGaps?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Typography variant="body2" color="text.secondary">No gaps identified.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {metrics.coverageGaps?.map(({ article, reason }) => (
                    <TableRow
                      key={article.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/kb/${article.id}`)}
                    >
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {article.number}
                        </Typography>
                      </TableCell>
                      <TableCell>{article.title}</TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{reason}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Box>
        </Stack>
      )}
    </Box>
  );
}
