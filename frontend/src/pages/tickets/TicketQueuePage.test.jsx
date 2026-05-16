import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import TicketQueuePage from './TicketQueuePage.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';
import { QUEUE_TICKETS, TICKET_CATEGORIES } from '../../graphql/tickets.js';

const USER_AUTH = {
  isAuthenticated: true,
  token: 'tok',
  user: {
    role: 'user',
    email: 'u@test.com',
    sub: 'u1',
    auth_method: 'password',
  },
};

const AGENT_AUTH = {
  isAuthenticated: true,
  token: 'tok-agent',
  user: {
    role: 'agent',
    email: 'agent@test.com',
    sub: 'ag1',
    auth_method: 'password',
  },
};

const DEFAULT_QUEUE_VARS = {
  filter: {},
  sort: { field: 'created_at', direction: 'DESC' },
  page: 1,
  pageSize: 25,
};

function RoutedQueueHarness() {
  return (
    <Routes>
      <Route path="/desk/queue" element={<TicketQueuePage />} />
      <Route path="/" element={<Typography>Home shortcut</Typography>} />
    </Routes>
  );
}

function catsMock() {
  return {
    request: { query: TICKET_CATEGORIES },
    result: {
      data: {
        ticketCategories: [{ id: 'c1', name: 'Hardware', slug: 'hw', isActive: true }],
      },
    },
    delay: 0,
  };
}

function queueMock(extra = {}) {
  return {
    request: {
      query: QUEUE_TICKETS,
      variables: DEFAULT_QUEUE_VARS,
    },
    result: {
      data: {
        tickets: {
          totalCount: 1,
          page: 1,
          pageSize: 25,
          edges: [
            {
              node: {
                id: 't1',
                publicNumber: '100',
                title: 'Queue ticket',
                status: 'OPEN',
                priority: 'HIGH',
                assignedTo: null,
                category: { id: 'c1', name: 'Hardware' },
                createdAt: new Date(Date.now() - 3600000).toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          ],
          ...extra,
        },
      },
    },
    delay: 0,
  };
}

describe('TicketQueuePage', () => {
  it('redirects standard users away from the desk queue', async () => {
    renderWithProviders(<RoutedQueueHarness />, {
      preloadedState: { auth: USER_AUTH },
      initialEntries: ['/desk/queue'],
    });
    await waitFor(() => {
      expect(screen.getByText('Home shortcut')).toBeInTheDocument();
    });
  });

  it('shows the queue heading for agents', async () => {
    renderWithProviders(<RoutedQueueHarness />, {
      preloadedState: { auth: AGENT_AUTH },
      mocks: [catsMock(), queueMock()],
      initialEntries: ['/desk/queue'],
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /service desk queue/i })).toBeInTheDocument();
    });
    expect(screen.getByText('Queue ticket')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /self-assign/i })).toBeInTheDocument();
  });
});
