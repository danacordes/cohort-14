import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';
import KBSearchPage from './KBSearchPage.jsx';

const AGENT_AUTH = { isAuthenticated: true, token: 'tok', user: { role: 'agent' } };

const PRELOADED_RESULTS = {
  kb: {
    searchResults: [
      {
        id: 'art-1',
        number: 'KB-0001',
        title: 'Fix VPN timeout',
        articleType: 'Solution',
        status: 'Published',
        category: { id: 'c1', name: 'Networking' },
        tags: [],
        excerpt: 'Increase the timeout value.',
        updatedAt: new Date().toISOString(),
      },
    ],
    searchMeta: {
      query: 'vpn',
      filters: {},
      page: 1,
      pageSize: 20,
      totalCount: 1,
      suggestions: [],
    },
    currentArticle: null,
    editorDraft: { title: '', body: '', articleType: '', categoryId: '', tags: [], reviewDueAt: null, expiresAt: null, attachments: [], validationErrors: {} },
    loading: { search: false, article: false, save: false, action: false, metrics: false },
    pendingReview: [],
    pendingReviewTotal: 0,
    adminMetrics: null,
    error: null,
  },
};

const EMPTY_RESULTS_WITH_SUGGESTIONS = {
  kb: {
    ...PRELOADED_RESULTS.kb,
    searchResults: [],
    searchMeta: {
      ...PRELOADED_RESULTS.kb.searchMeta,
      totalCount: 0,
      suggestions: ['VPN', 'timeout'],
    },
  },
};

function renderPage(preloadedState = {}) {
  return renderWithProviders(<KBSearchPage />, {
    preloadedState: { auth: AGENT_AUTH, ...preloadedState },
    initialEntries: ['/kb'],
  });
}

describe('KBSearchPage — layout', () => {
  it('renders the search bar', () => {
    renderPage();
    expect(screen.getByPlaceholderText(/search articles/i)).toBeInTheDocument();
  });

  it('renders the Search button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /^search$/i })).toBeInTheDocument();
  });

  it('renders the Filters toggle button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
  });

  it('renders the New Article button for agents', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /new article/i })).toBeInTheDocument();
  });

  it('renders Knowledge Base heading', () => {
    renderPage();
    expect(screen.getByText('Knowledge Base')).toBeInTheDocument();
  });
});

describe('KBSearchPage — results from preloaded store', () => {
  it('displays a result card when store has results', () => {
    renderPage(PRELOADED_RESULTS);
    expect(screen.getByText('Fix VPN timeout')).toBeInTheDocument();
    expect(screen.getByText('KB-0001')).toBeInTheDocument();
  });

  it('displays the article type chip on a result card', () => {
    renderPage(PRELOADED_RESULTS);
    expect(screen.getByText('Solution')).toBeInTheDocument();
  });

  it('displays the article status badge on a result card', () => {
    renderPage(PRELOADED_RESULTS);
    // The result card renders a Chip with the status; filter dropdown may also contain 'Published'
    const badges = screen.getAllByText('Published');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });
});

describe('KBSearchPage — empty state', () => {
  it('does not show empty state before a search has been submitted', () => {
    renderPage();
    expect(screen.queryByText(/no results found/i)).not.toBeInTheDocument();
  });
});
