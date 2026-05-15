import { createSlice } from '@reduxjs/toolkit';

const emptyDraft = {
  title: '',
  body: '',
  articleType: '',
  categoryId: '',
  tags: [],
  reviewDueAt: null,
  expiresAt: null,
  attachments: [],
  validationErrors: {},
};

const initialState = {
  searchResults: [],
  searchMeta: {
    query: '',
    filters: {},
    page: 1,
    pageSize: 20,
    totalCount: 0,
    suggestions: [],
  },
  currentArticle: null,
  editorDraft: { ...emptyDraft },
  loading: {
    search: false,
    article: false,
    save: false,
    action: false,
    metrics: false,
  },
  pendingReview: [],
  pendingReviewTotal: 0,
  adminMetrics: null,
  error: null,
};

const kbSlice = createSlice({
  name: 'kb',
  initialState,
  reducers: {
    setSearchResults(state, action) {
      const { items, totalCount, page, pageSize, suggestions } = action.payload;
      state.searchResults = items;
      state.searchMeta.totalCount = totalCount;
      state.searchMeta.page = page;
      state.searchMeta.pageSize = pageSize;
      state.searchMeta.suggestions = suggestions ?? [];
    },

    setSearchQuery(state, action) {
      state.searchMeta.query = action.payload;
    },

    setSearchFilters(state, action) {
      state.searchMeta.filters = action.payload;
      state.searchMeta.page = 1;
    },

    setSearchPage(state, action) {
      state.searchMeta.page = action.payload;
    },

    setCurrentArticle(state, action) {
      state.currentArticle = action.payload;
    },

    clearCurrentArticle(state) {
      state.currentArticle = null;
    },

    setEditorDraft(state, action) {
      state.editorDraft = { ...emptyDraft, ...action.payload, validationErrors: {} };
    },

    patchDraft(state, action) {
      state.editorDraft = { ...state.editorDraft, ...action.payload };
    },

    setDraftValidationErrors(state, action) {
      state.editorDraft.validationErrors = action.payload;
    },

    resetDraft(state) {
      state.editorDraft = { ...emptyDraft };
    },

    setLoading(state, action) {
      const { key, value } = action.payload;
      state.loading[key] = value;
    },

    setError(state, action) {
      state.error = action.payload;
    },

    clearError(state) {
      state.error = null;
    },

    setPendingReview(state, action) {
      const { items, totalCount } = action.payload;
      state.pendingReview = items;
      state.pendingReviewTotal = totalCount;
    },

    setAdminMetrics(state, action) {
      state.adminMetrics = action.payload;
    },
  },
});

export const {
  setSearchResults,
  setSearchQuery,
  setSearchFilters,
  setSearchPage,
  setCurrentArticle,
  clearCurrentArticle,
  setEditorDraft,
  patchDraft,
  setDraftValidationErrors,
  resetDraft,
  setLoading,
  setError,
  clearError,
  setPendingReview,
  setAdminMetrics,
} = kbSlice.actions;

export const selectSearchResults = (state) => state.kb.searchResults;
export const selectSearchMeta = (state) => state.kb.searchMeta;
export const selectCurrentArticle = (state) => state.kb.currentArticle;
export const selectEditorDraft = (state) => state.kb.editorDraft;
export const selectKBLoading = (key) => (state) => state.kb.loading[key];
export const selectKBError = (state) => state.kb.error;
export const selectPendingReview = (state) => state.kb.pendingReview;
export const selectPendingReviewTotal = (state) => state.kb.pendingReviewTotal;
export const selectAdminMetrics = (state) => state.kb.adminMetrics;

export default kbSlice.reducer;
