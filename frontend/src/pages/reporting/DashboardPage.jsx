import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLazyQuery } from '@apollo/client/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import { DASHBOARD_QUERY } from '../../graphql/reporting.js';
import {
  setDashboardMetrics,
  setDashboardPeriod,
  setLoading,
  setError,
  selectDashboardMetrics,
  selectDashboardPeriod,
  selectReportLoading,
  selectReportError,
} from '../../store/reportingSlice.js';

const PERIODS = [
  { value: 'TODAY', label: 'Today' },
  { value: 'LAST_7_DAYS', label: 'Last 7 Days' },
  { value: 'LAST_30_DAYS', label: 'Last 30 Days' },
  { value: 'LAST_90_DAYS', label: 'Last 90 Days' },
];

function MetricCard({ label, value, unit }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={700} mt={0.5}>
        {value ?? '—'}
        {unit && (
          <Typography component="span" variant="body2" color="text.secondary" ml={0.5}>
            {unit}
          </Typography>
        )}
      </Typography>
    </Paper>
  );
}

function formatMinutes(minutes) {
  if (minutes == null) return '—';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

function formatPercent(rate) {
  if (rate == null) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

export default function DashboardPage() {
  const dispatch = useDispatch();
  const metrics = useSelector(selectDashboardMetrics);
  const period = useSelector(selectDashboardPeriod);
  const loading = useSelector(selectReportLoading('dashboard'));
  const error = useSelector(selectReportError('dashboard'));

  const [fetchDashboard] = useLazyQuery(DASHBOARD_QUERY, {
    fetchPolicy: 'network-only',
    onCompleted(data) {
      dispatch(setDashboardMetrics(data.dashboard));
      dispatch(setLoading({ key: 'dashboard', value: false }));
      dispatch(setError({ key: 'dashboard', value: null }));
    },
    onError(err) {
      dispatch(setLoading({ key: 'dashboard', value: false }));
      dispatch(setError({ key: 'dashboard', value: err.message }));
    },
  });

  const load = useCallback(() => {
    dispatch(setLoading({ key: 'dashboard', value: true }));
    fetchDashboard({ variables: { period } });
  }, [dispatch, fetchDashboard, period]);

  useEffect(() => {
    load();
    const intervalId = setInterval(load, 30_000);
    return () => clearInterval(intervalId);
  }, [load]);

  function handlePeriodChange(e) {
    dispatch(setDashboardPeriod(e.target.value));
  }

  return (
    <Box p={4} maxWidth={1100}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h4" fontWeight={700}>
          Operational Dashboard
        </Typography>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Period</InputLabel>
          <Select value={period} label="Period" onChange={handlePeriodChange}>
            {PERIODS.map((p) => (
              <MenuItem key={p.value} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && !metrics && (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      )}

      {metrics && (
        <>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard label="Open Tickets" value={metrics.openTicketCount} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard label="Backlog Size" value={metrics.backlogSize} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard label="Unassigned" value={metrics.unassignedTicketCount} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                label="SLA Compliance"
                value={formatPercent(metrics.slaComplianceRate)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard label="Tickets Created" value={metrics.ticketsCreatedInPeriod} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard label="Tickets Closed" value={metrics.ticketsClosedInPeriod} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                label="Avg First Response"
                value={formatMinutes(metrics.avgFirstResponseTime)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard label="Avg MTTR" value={formatMinutes(metrics.avgMttr)} />
            </Grid>
          </Grid>

          <Divider sx={{ my: 4 }} />

          <Typography variant="h6" fontWeight={600} mb={2}>
            Ticket Trend
          </Typography>
          <TicketTrendChart created={metrics.ticketsCreatedInPeriod} closed={metrics.ticketsClosedInPeriod} />
        </>
      )}
    </Box>
  );
}

function TicketTrendChart({ created, closed }) {
  const max = Math.max(created ?? 0, closed ?? 0, 1);
  const createdPct = ((created ?? 0) / max) * 100;
  const closedPct = ((closed ?? 0) / max) * 100;

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={1} gap={1}>
        <Typography variant="body2" sx={{ width: 80 }}>
          Created
        </Typography>
        <Box
          sx={{
            height: 24,
            width: `${createdPct}%`,
            bgcolor: 'primary.main',
            borderRadius: 1,
            minWidth: 4,
          }}
        />
        <Typography variant="body2">{created ?? 0}</Typography>
      </Box>
      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body2" sx={{ width: 80 }}>
          Closed
        </Typography>
        <Box
          sx={{
            height: 24,
            width: `${closedPct}%`,
            bgcolor: 'success.main',
            borderRadius: 1,
            minWidth: 4,
          }}
        />
        <Typography variant="body2">{closed ?? 0}</Typography>
      </Box>
    </Box>
  );
}
