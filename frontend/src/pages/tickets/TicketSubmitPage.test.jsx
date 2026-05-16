import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TicketSubmitPage from './TicketSubmitPage.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';
import { TICKET_CATEGORIES, CREATE_TICKET } from '../../graphql/tickets.js';

const USER_AUTH = { isAuthenticated: true, token: 'tok', user: { role: 'user', email: 'u@test.com', sub: 'u1', auth_method: 'password' } };

function catMock() {
  return {
    request: { query: TICKET_CATEGORIES },
    result: {
      data: {
        ticketCategories: [
          { id: 'c1', name: 'Hardware', slug: 'hardware', isActive: true },
        ],
      },
    },
    delay: 0,
  };
}

describe('TicketSubmitPage', () => {
  it('renders title and description fields', async () => {
    renderWithProviders(<TicketSubmitPage />, {
      preloadedState: { auth: USER_AUTH },
      initialEntries: ['/tickets/submit'],
      mocks: [catMock()],
    });
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /title/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('textbox', { name: /description/i })).toBeInTheDocument();
  });

  it('shows validation errors when required fields are empty', async () => {
    renderWithProviders(<TicketSubmitPage />, {
      preloadedState: { auth: USER_AUTH },
      mocks: [catMock()],
      initialEntries: ['/tickets/submit'],
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit ticket/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /submit ticket/i }));

    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
    expect(screen.getByText(/description is required/i)).toBeInTheDocument();
  });

  it('submits and shows confirmation with ticket number', async () => {
    const mocks = [
      catMock(),
      {
        request: {
          query: CREATE_TICKET,
          variables: {
            input: {
              title: 'VPN down',
              description: 'Cannot connect',
              priority: 'MEDIUM',
              categoryId: undefined,
              attachments: undefined,
            },
          },
        },
        result: {
          data: {
            createTicket: {
              id: 'tid-1',
              publicNumber: '42',
              title: 'VPN down',
              status: 'OPEN',
              priority: 'MEDIUM',
            },
          },
        },
        delay: 0,
      },
    ];

    renderWithProviders(<TicketSubmitPage />, {
      preloadedState: { auth: USER_AUTH },
      mocks,
      initialEntries: ['/tickets/submit'],
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    });
    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'VPN down');
    await userEvent.type(screen.getByRole('textbox', { name: /description/i }), 'Cannot connect');
    await userEvent.click(screen.getByRole('button', { name: /submit ticket/i }));

    await waitFor(() => {
      expect(screen.getByText(/ticket received/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/#42/)).toBeInTheDocument();
  });
});
