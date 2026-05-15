import { createSlice } from '@reduxjs/toolkit';

const DEFAULT_FILTERS = {
  dateRangePreset: 'LAST_30_DAYS',
  customDateRange: { startDate: null, endDate: null },
  priority: null,
  category: null,
  agentId: null,
};

const initialState = {
  dashboardMetrics: null,
  dashboardPeriod: 'LAST_30_DAYS',
  reports: {
    ticketVolume: null,
    slaPerformance: null,
    agentPerformance: null,
    quality: null,
    kbUsage: null,
  },
  filters: { ...DEFAULT_FILTERS },
  loading: {
    dashboard: false,
    ticketVolume: false,
    slaPerformance: false,
    agentPerformance: false,
    quality: false,
    kbUsage: false,
  },
  error: {
    dashboard: null,
    ticketVolume: null,
    slaPerformance: null,
    agentPerformance: null,
    quality: null,
    kbUsage: null,
  },
};

const reportingSlice = createSlice({
  name: 'reporting',
  initialState,
  reducers: {
    setDashboardMetrics(state, action) {
      state.dashboardMetrics = action.payload;
    },
    setDashboardPeriod(state, action) {
      state.dashboardPeriod = action.payload;
    },
    setReportData(state, action) {
      const { reportType, data } = action.payload;
      state.reports[reportType] = data;
    },
    setFilter(state, action) {
      const { key, value } = action.payload;
      state.filters[key] = value;
    },
    resetFilters(state) {
      state.filters = { ...DEFAULT_FILTERS };
    },
    setLoading(state, action) {
      const { key, value } = action.payload;
      state.loading[key] = value;
    },
    setError(state, action) {
      const { key, value } = action.payload;
      state.error[key] = value;
    },
    clearError(state, action) {
      state.error[action.payload] = null;
    },
  },
});

export const {
  setDashboardMetrics,
  setDashboardPeriod,
  setReportData,
  setFilter,
  resetFilters,
  setLoading,
  setError,
  clearError,
} = reportingSlice.actions;

export const selectDashboardMetrics = (state) => state.reporting.dashboardMetrics;
export const selectDashboardPeriod = (state) => state.reporting.dashboardPeriod;
export const selectReportData = (reportType) => (state) => state.reporting.reports[reportType];
export const selectFilters = (state) => state.reporting.filters;
export const selectReportLoading = (key) => (state) => state.reporting.loading[key];
export const selectReportError = (key) => (state) => state.reporting.error[key];

export default reportingSlice.reducer;
