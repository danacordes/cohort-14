import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useLazyQuery } from '@apollo/client/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import TablePagination from '@mui/material/TablePagination';
import Divider from '@mui/material/Divider';
import {
  TICKET_VOLUME_REPORT,
  SLA_PERFORMANCE_REPORT,
  AGENT_PERFORMANCE_REPORT,
  QUALITY_REPORT,
  KB_USAGE_REPORT,
} from '../../graphql/reporting.js';
import {
  setReportData,
  setFilter,
  setLoading,
  setError,
  selectReportData,
  selectFilters,
  selectReportLoading,
  selectReportError,
} from '../../store/reportingSlice.js';
import { selectRole } from '../../store/authSlice.js';
import { exportReportToCSV } from '../../services/reportExport.js';
import TicketVolumeReport from './reports/TicketVolumeReport.jsx';
import SLAPerformanceReport from './reports/SLAPerformanceReport.jsx';
import AgentPerformanceReport from './reports/AgentPerformanceReport.jsx';
import QualityReport from './reports/QualityReport.jsx';
import KBUsageReport from './reports/KBUsageReport.jsx';

const REPORT_CONFIG = {
  'ticket-volume': {
    label: 'Ticket Volume',
    query: TICKET_VOLUME_REPORT,
    key: 'ticketVolumeReport',
    storeKey: 'ticketVolume',
    adminOnly: false,
  },
  'sla-performance': {
    label: 'SLA Performance',
    query: SLA_PERFORMANCE_REPORT,
    key: 'slaPerformanceReport',
    storeKey: 'slaPerformance',
    adminOnly: false,
  },
  'agent-performance': {
    label: 'Agent Performance',
    query: AGENT_PERFORMANCE_REPORT,
    key: 'agentPerformanceReport',
    storeKey: 'agentPerformance',
    adminOnly: true,
  },
  quality: {
    label: 'Quality & Satisfaction',
    query: QUALITY_REPORT,
    key: 'qualityReport',
    storeKey: 'quality',
    adminOnly: false,
  },
  'kb-usage': {
    label: 'KB Usage',
    query: KB_USAGE_REPORT,
    key: 'kbUsageReport',
    storeKey: 'kbUsage',
    adminOnly: true,
  },
};

const PERIODS = [
  { value: 'TODAY', label: 'Today' },
  { value: 'LAST_7_DAYS', label: 'Last 7 Days' },
  { value: 'LAST_30_DAYS', label: 'Last 30 Days' },
  { value: 'LAST_90_DAYS', label: 'Last 90 Days' },
  { value: 'CUSTOM', label: 'Custom Range' },
];

const PRIORITIES = ['', 'low', 'medium', 'high', 'critical'];

function buildFiltersInput(filters) {
  const input = { dateRangePreset: filters.dateRangePreset };
  if (filters.dateRangePreset === 'CUSTOM') {
    input.startDate = filters.customDateRange?.startDate ?? undefined;
    input.endDate = filters.customDateRange?.endDate ?? undefined;
  }
  if (filters.priority) input.priority = filters.priority;
  if (filters.category) input.category = filters.category;
  if (filters.agentId) input.agentId = filters.agentId;
  return input;
}

function flattenForExport(reportType, data) {
  if (!data) return [];
  switch (reportType) {
    case 'ticket-volume':
      return data.trend ?? [];
    case 'sla-performance':
      return data.breachedTickets ?? [];
    case 'agent-performance':
      return data.agents ?? [];
    case 'quality':
      return data.categoryBreakdown ?? [];
    case 'kb-usage':
      return data.topViewedArticles ?? [];
    default:
      return [];
  }
}

export default function ReportPage() {
  const { reportType } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const role = useSelector(selectRole);
  const filters = useSelector(selectFilters);
  const [page, setPage] = useState(0);

  const config = REPORT_CONFIG[reportType];

  useEffect(() => {
    if (config?.adminOnly && role !== 'admin') {
      navigate('/reporting', { replace: true });
    }
  }, [config, role, navigate]);

  const reportData = useSelector(selectReportData(config?.storeKey));
  const loading = useSelector(selectReportLoading(config?.storeKey));
  const error = useSelector(selectReportError(config?.storeKey));

  const [fetchReport] = useLazyQuery(config?.query ?? TICKET_VOLUME_REPORT, {
    fetchPolicy: 'network-only',
    onCompleted(data) {
      const key = config.key;
      dispatch(setReportData({ reportType: config.storeKey, data: data[key] }));
      dispatch(setLoading({ key: config.storeKey, value: false }));
      dispatch(setError({ key: config.storeKey, value: null }));
      setPage(0);
    },
    onError(err) {
      dispatch(setLoading({ key: config.storeKey, value: false }));
      dispatch(setError({ key: config.storeKey, value: err.message }));
    },
  });

  useEffect(() => {
    if (!config) return;
    dispatch(setLoading({ key: config.storeKey, value: true }));
    fetchReport({ variables: { filters: buildFiltersInput(filters) } });
  }, [filters, config?.storeKey]);

  function handleFilterChange(key, value) {
    dispatch(setFilter({ key, value }));
  }

  function handleExport() {
    const rows = flattenForExport(reportType, reportData);
    exportReportToCSV(config.label, rows, filters);
  }

  if (!config) {
    return (
      <Box p={4}>
        <Alert severity="error">Unknown report type: {reportType}</Alert>
      </Box>
    );
  }

  return (
    <Box p={4} maxWidth={1100}>
      <Typography variant="h4" fontWeight={700} mb={3}>
        {config.label}
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" fontWeight={600} mb={2}>
          Filters
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Date Range</InputLabel>
            <Select
              value={filters.dateRangePreset}
              label="Date Range"
              onChange={(e) => handleFilterChange('dateRangePreset', e.target.value)}
            >
              {PERIODS.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {filters.dateRangePreset === 'CUSTOM' && (
            <>
              <TextField
                size="small"
                type="date"
                label="Start Date"
                InputLabelProps={{ shrink: true }}
                value={filters.customDateRange?.startDate ?? ''}
                onChange={(e) =>
                  handleFilterChange('customDateRange', {
                    ...filters.customDateRange,
                    startDate: e.target.value,
                  })
                }
              />
              <TextField
                size="small"
                type="date"
                label="End Date"
                InputLabelProps={{ shrink: true }}
                value={filters.customDateRange?.endDate ?? ''}
                onChange={(e) =>
                  handleFilterChange('customDateRange', {
                    ...filters.customDateRange,
                    endDate: e.target.value,
                  })
                }
              />
            </>
          )}

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={filters.priority ?? ''}
              label="Priority"
              onChange={(e) => handleFilterChange('priority', e.target.value || null)}
            >
              {PRIORITIES.map((p) => (
                <MenuItem key={p} value={p}>
                  {p === '' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="Category"
            value={filters.category ?? ''}
            onChange={(e) => handleFilterChange('category', e.target.value || null)}
            sx={{ minWidth: 140 }}
          />

          {reportType === 'agent-performance' && role === 'admin' && (
            <TextField
              size="small"
              label="Agent ID"
              value={filters.agentId ?? ''}
              onChange={(e) => handleFilterChange('agentId', e.target.value || null)}
              sx={{ minWidth: 140 }}
            />
          )}
        </Stack>
      </Paper>

      <Box display="flex" justifyContent="flex-end" mb={2}>
        <Button variant="outlined" size="small" onClick={handleExport} disabled={!reportData}>
          Export CSV
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && !reportData && (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      )}

      <Divider sx={{ mb: 3 }} />

      {reportType === 'ticket-volume' && <TicketVolumeReport data={reportData} />}
      {reportType === 'sla-performance' && <SLAPerformanceReport data={reportData} />}
      {reportType === 'agent-performance' && <AgentPerformanceReport data={reportData} />}
      {reportType === 'quality' && (
        <QualityReport data={reportData} isAdmin={role === 'admin'} />
      )}
      {reportType === 'kb-usage' && <KBUsageReport data={reportData} />}

      {reportData && (
        <TablePagination
          component="div"
          count={-1}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={25}
          rowsPerPageOptions={[25]}
          labelDisplayedRows={({ from, to }) => `${from}–${to}`}
          sx={{ mt: 2 }}
        />
      )}
    </Box>
  );
}
