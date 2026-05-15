import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import reportingReducer, {
  setDashboardMetrics,
  setDashboardPeriod,
  setReportData,
  setFilter,
  resetFilters,
  setLoading,
  setError,
  clearError,
  selectDashboardMetrics,
  selectDashboardPeriod,
  selectReportData,
  selectFilters,
  selectReportLoading,
  selectReportError,
} from './reportingSlice.js';

function makeStore(preloadedState) {
  return configureStore({
    reducer: { reporting: reportingReducer },
    preloadedState,
  });
}

describe('reportingSlice — initial state', () => {
  it('has expected default values', () => {
    const store = makeStore();
    const state = store.getState().reporting;
    expect(state.dashboardMetrics).toBeNull();
    expect(state.dashboardPeriod).toBe('LAST_30_DAYS');
    expect(state.filters.dateRangePreset).toBe('LAST_30_DAYS');
    expect(state.filters.priority).toBeNull();
    expect(state.loading.dashboard).toBe(false);
    expect(state.error.dashboard).toBeNull();
  });
});

describe('setDashboardMetrics', () => {
  it('stores dashboard metrics', () => {
    const store = makeStore();
    const metrics = { openTicketCount: 5, backlogSize: 12 };
    store.dispatch(setDashboardMetrics(metrics));
    expect(selectDashboardMetrics(store.getState())).toEqual(metrics);
  });
});

describe('setDashboardPeriod', () => {
  it('updates the dashboard period', () => {
    const store = makeStore();
    store.dispatch(setDashboardPeriod('TODAY'));
    expect(selectDashboardPeriod(store.getState())).toBe('TODAY');
  });
});

describe('setReportData', () => {
  it('stores data for the specified report type', () => {
    const store = makeStore();
    const data = { totalSubmitted: 100, totalClosed: 80 };
    store.dispatch(setReportData({ reportType: 'ticketVolume', data }));
    expect(selectReportData('ticketVolume')(store.getState())).toEqual(data);
  });
});

describe('setFilter', () => {
  it('updates a specific filter key', () => {
    const store = makeStore();
    store.dispatch(setFilter({ key: 'priority', value: 'high' }));
    expect(selectFilters(store.getState()).priority).toBe('high');
  });

  it('does not reset other filters', () => {
    const store = makeStore();
    store.dispatch(setFilter({ key: 'priority', value: 'high' }));
    store.dispatch(setFilter({ key: 'category', value: 'network' }));
    const filters = selectFilters(store.getState());
    expect(filters.priority).toBe('high');
    expect(filters.category).toBe('network');
  });
});

describe('resetFilters', () => {
  it('restores all filters to defaults', () => {
    const store = makeStore();
    store.dispatch(setFilter({ key: 'priority', value: 'critical' }));
    store.dispatch(setFilter({ key: 'category', value: 'hardware' }));
    store.dispatch(resetFilters());
    const filters = selectFilters(store.getState());
    expect(filters.priority).toBeNull();
    expect(filters.category).toBeNull();
    expect(filters.dateRangePreset).toBe('LAST_30_DAYS');
  });
});

describe('setLoading', () => {
  it('toggles loading state for a key', () => {
    const store = makeStore();
    store.dispatch(setLoading({ key: 'dashboard', value: true }));
    expect(selectReportLoading('dashboard')(store.getState())).toBe(true);
    store.dispatch(setLoading({ key: 'dashboard', value: false }));
    expect(selectReportLoading('dashboard')(store.getState())).toBe(false);
  });
});

describe('setError / clearError', () => {
  it('sets and clears error for a key', () => {
    const store = makeStore();
    store.dispatch(setError({ key: 'ticketVolume', value: 'Network error' }));
    expect(selectReportError('ticketVolume')(store.getState())).toBe('Network error');
    store.dispatch(clearError('ticketVolume'));
    expect(selectReportError('ticketVolume')(store.getState())).toBeNull();
  });
});
