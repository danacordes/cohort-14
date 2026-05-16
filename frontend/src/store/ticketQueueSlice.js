import { createSlice } from '@reduxjs/toolkit';

/** @typedef {'ALL'|'UNASSIGNED'|string} AssigneeQueueFilter OTHER encodes agent id */

const initialState = {
  /** status enum string or '' */
  status: '',
  priority: '',
  categoryId: '',
  assigneeFilter: /** @type {AssigneeQueueFilter} */ ('ALL'),
  search: '',
  sortField: 'created_at',
  sortDirection: /** @type {'ASC'|'DESC'} */ ('DESC'),
  page: 1,
  pageSize: 25,
};

const ticketQueueSlice = createSlice({
  name: 'ticketQueue',
  initialState,
  reducers: {
    setQueueFilter(state, action) {
      Object.assign(state, action.payload);
      state.page = 1;
    },
    setQueueSort(state, action) {
      const { sortField, sortDirection } = action.payload;
      if (sortField != null) state.sortField = sortField;
      if (sortDirection != null) state.sortDirection = sortDirection;
      state.page = 1;
    },
    setQueuePagination(state, action) {
      const { page, pageSize } = action.payload;
      if (page != null) state.page = page;
      if (pageSize != null) state.pageSize = pageSize;
    },
    resetQueueFilters() {
      return { ...initialState };
    },
  },
});

export const { setQueueFilter, setQueueSort, setQueuePagination, resetQueueFilters } =
  ticketQueueSlice.actions;

export const selectTicketQueueState = (state) => state.ticketQueue;

export default ticketQueueSlice.reducer;
