import { describe, it, expect } from 'vitest';
import kbReducer, {
  setSearchResults,
  setSearchQuery,
  setSearchFilters,
  setSearchPage,
  setCurrentArticle,
  clearCurrentArticle,
  setEditorDraft,
  patchDraft,
  resetDraft,
  setDraftValidationErrors,
  setLoading,
  setError,
  clearError,
  setPendingReview,
  setAdminMetrics,
  selectSearchResults,
  selectSearchMeta,
  selectCurrentArticle,
  selectEditorDraft,
  selectKBLoading,
  selectKBError,
  selectPendingReview,
  selectPendingReviewTotal,
  selectAdminMetrics,
} from './kbSlice.js';

const initialState = kbReducer(undefined, { type: '@@INIT' });

const mockArticle = {
  id: 'art-1',
  number: 'KB-0001',
  title: 'Fix network timeout',
  body: 'Step 1: ...',
  articleType: 'Solution',
  status: 'Published',
  category: { id: 'cat-1', name: 'Networking' },
  tags: ['timeout', 'network'],
  currentVersion: 1,
  versionHistory: [],
  feedbackSummary: { helpfulCount: 5, notHelpfulCount: 1, userRating: null },
};

describe('kbSlice — initial state', () => {
  it('starts with empty search results', () => {
    expect(initialState.searchResults).toEqual([]);
  });

  it('starts with empty editor draft', () => {
    expect(initialState.editorDraft.title).toBe('');
    expect(initialState.editorDraft.tags).toEqual([]);
    expect(initialState.editorDraft.validationErrors).toEqual({});
  });

  it('all loading flags start as false', () => {
    expect(initialState.loading.search).toBe(false);
    expect(initialState.loading.article).toBe(false);
    expect(initialState.loading.save).toBe(false);
    expect(initialState.loading.action).toBe(false);
  });
});

describe('setSearchResults', () => {
  const payload = {
    items: [mockArticle],
    totalCount: 1,
    page: 1,
    pageSize: 20,
    suggestions: ['network timeout fix'],
  };

  it('populates searchResults', () => {
    const state = kbReducer(initialState, setSearchResults(payload));
    expect(state.searchResults).toHaveLength(1);
    expect(state.searchResults[0].id).toBe('art-1');
  });

  it('updates pagination meta', () => {
    const state = kbReducer(initialState, setSearchResults(payload));
    expect(state.searchMeta.totalCount).toBe(1);
    expect(state.searchMeta.page).toBe(1);
  });

  it('stores suggestions', () => {
    const state = kbReducer(initialState, setSearchResults(payload));
    expect(state.searchMeta.suggestions).toEqual(['network timeout fix']);
  });

  it('defaults suggestions to empty array when omitted', () => {
    const { suggestions, ...noSuggestions } = payload;
    const state = kbReducer(initialState, setSearchResults(noSuggestions));
    expect(state.searchMeta.suggestions).toEqual([]);
  });
});

describe('setSearchQuery / setSearchFilters / setSearchPage', () => {
  it('setSearchQuery updates the query string', () => {
    const state = kbReducer(initialState, setSearchQuery('vpn error'));
    expect(state.searchMeta.query).toBe('vpn error');
  });

  it('setSearchFilters updates filters and resets page to 1', () => {
    const withPage = kbReducer(initialState, setSearchPage(3));
    const state = kbReducer(withPage, setSearchFilters({ status: 'Published', articleType: 'FAQ' }));
    expect(state.searchMeta.filters).toEqual({ status: 'Published', articleType: 'FAQ' });
    expect(state.searchMeta.page).toBe(1);
  });

  it('setSearchPage sets the page number', () => {
    const state = kbReducer(initialState, setSearchPage(4));
    expect(state.searchMeta.page).toBe(4);
  });
});

describe('currentArticle', () => {
  it('setCurrentArticle stores the article', () => {
    const state = kbReducer(initialState, setCurrentArticle(mockArticle));
    expect(state.currentArticle).toEqual(mockArticle);
  });

  it('clearCurrentArticle resets to null', () => {
    const withArticle = kbReducer(initialState, setCurrentArticle(mockArticle));
    const state = kbReducer(withArticle, clearCurrentArticle());
    expect(state.currentArticle).toBeNull();
  });
});

describe('editorDraft', () => {
  it('setEditorDraft replaces draft and clears validationErrors', () => {
    const withErrors = kbReducer(
      initialState,
      setDraftValidationErrors({ title: 'Required' })
    );
    const state = kbReducer(
      withErrors,
      setEditorDraft({ title: 'New title', body: 'Content' })
    );
    expect(state.editorDraft.title).toBe('New title');
    expect(state.editorDraft.validationErrors).toEqual({});
  });

  it('patchDraft merges fields without losing existing ones', () => {
    const withDraft = kbReducer(initialState, setEditorDraft({ title: 'Draft', body: 'Body' }));
    const state = kbReducer(withDraft, patchDraft({ title: 'Updated Title' }));
    expect(state.editorDraft.title).toBe('Updated Title');
    expect(state.editorDraft.body).toBe('Body');
  });

  it('resetDraft returns to empty defaults', () => {
    const withDraft = kbReducer(initialState, setEditorDraft({ title: 'Something' }));
    const state = kbReducer(withDraft, resetDraft());
    expect(state.editorDraft.title).toBe('');
    expect(state.editorDraft.tags).toEqual([]);
  });

  it('setDraftValidationErrors sets error map', () => {
    const state = kbReducer(
      initialState,
      setDraftValidationErrors({ title: 'Required', categoryId: 'Required' })
    );
    expect(state.editorDraft.validationErrors.title).toBe('Required');
    expect(state.editorDraft.validationErrors.categoryId).toBe('Required');
  });
});

describe('loading and error', () => {
  it('setLoading updates the correct flag', () => {
    const state = kbReducer(initialState, setLoading({ key: 'search', value: true }));
    expect(state.loading.search).toBe(true);
    expect(state.loading.article).toBe(false);
  });

  it('setError stores the error message', () => {
    const state = kbReducer(initialState, setError('Network error'));
    expect(state.error).toBe('Network error');
  });

  it('clearError resets to null', () => {
    const withError = kbReducer(initialState, setError('Oops'));
    const state = kbReducer(withError, clearError());
    expect(state.error).toBeNull();
  });
});

describe('pendingReview', () => {
  const pendingPayload = {
    items: [{ id: 'art-2', number: 'KB-0002', title: 'Pending Article', status: 'PendingReview' }],
    totalCount: 1,
  };

  it('stores pending review articles and total', () => {
    const state = kbReducer(initialState, setPendingReview(pendingPayload));
    expect(state.pendingReview).toHaveLength(1);
    expect(state.pendingReviewTotal).toBe(1);
  });
});

describe('adminMetrics', () => {
  const metricsPayload = {
    deflectionCount: 42,
    topViewed: [],
    feedbackTrends: [],
    coverageGaps: [],
  };

  it('stores admin metrics', () => {
    const state = kbReducer(initialState, setAdminMetrics(metricsPayload));
    expect(state.adminMetrics.deflectionCount).toBe(42);
  });
});

describe('selectors', () => {
  const storeShape = (kb) => ({ kb });

  it('selectSearchResults returns search results', () => {
    const s = kbReducer(initialState, setSearchResults({ items: [mockArticle], totalCount: 1, page: 1, pageSize: 20 }));
    expect(selectSearchResults(storeShape(s))).toHaveLength(1);
  });

  it('selectKBLoading returns the correct loading flag', () => {
    const s = kbReducer(initialState, setLoading({ key: 'save', value: true }));
    expect(selectKBLoading('save')(storeShape(s))).toBe(true);
    expect(selectKBLoading('search')(storeShape(s))).toBe(false);
  });

  it('selectKBError returns the error', () => {
    const s = kbReducer(initialState, setError('fail'));
    expect(selectKBError(storeShape(s))).toBe('fail');
  });

  it('selectAdminMetrics returns null initially', () => {
    expect(selectAdminMetrics(storeShape(initialState))).toBeNull();
  });

  it('selectPendingReviewTotal returns 0 initially', () => {
    expect(selectPendingReviewTotal(storeShape(initialState))).toBe(0);
  });
});
