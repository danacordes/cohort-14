import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AIInsightsPanel from './AIInsightsPanel.jsx';
import { renderWithProviders } from '../test/renderWithProviders.jsx';
import { SUGGEST_TICKET_CATEGORY, SUMMARIZE_TICKET } from '../graphql/ai.js';

const AGENT_AUTH = {
  isAuthenticated: true,
  token: 'tok',
  user: { role: 'agent', email: 'a@test.com', sub: 'a1', auth_method: 'password' },
};

describe('AIInsightsPanel', () => {
  it('renders nothing for end-user role', () => {
    const { container } = renderWithProviders(
      <AIInsightsPanel mode="submit" role="user" title="VPN" description="broken" />,
      { preloadedState: { auth: { ...AGENT_AUTH, user: { ...AGENT_AUTH.user, role: 'user' } } } },
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows category suggestion and accept applies callback', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    const mocks = [
      {
        request: {
          query: SUGGEST_TICKET_CATEGORY,
          variables: { title: 'VPN issue', description: 'cannot connect' },
        },
        result: {
          data: {
            suggestTicketCategory: {
              categoryId: 'c-net',
              categoryName: 'Network',
              confidence: 0.82,
            },
          },
        },
        delay: 0,
      },
    ];

    renderWithProviders(
      <AIInsightsPanel
        mode="submit"
        role="agent"
        title="VPN issue"
        description="cannot connect"
        onAcceptCategory={onAccept}
        suggestDebounceMs={0}
      />,
      { preloadedState: { auth: AGENT_AUTH }, mocks },
    );

    await waitFor(() => {
      expect(screen.getByText(/Suggested category/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Confidence: 82%/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /accept/i }));
    expect(onAccept).toHaveBeenCalledWith('c-net');
  });

  it('hides silently when suggest returns null', async () => {
    const mocks = [
      {
        request: {
          query: SUGGEST_TICKET_CATEGORY,
          variables: { title: 'x', description: '' },
        },
        result: { data: { suggestTicketCategory: null } },
        delay: 0,
      },
    ];

    const { container } = renderWithProviders(
      <AIInsightsPanel
        mode="submit"
        role="agent"
        title="x"
        description=""
        suggestDebounceMs={0}
      />,
      { preloadedState: { auth: AGENT_AUTH }, mocks },
    );

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('shows summary after summarize click', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: SUMMARIZE_TICKET,
          variables: { ticketId: 't-1' },
        },
        result: { data: { summarizeTicket: 'User reported VPN failure. Agent reset client.' } },
        delay: 0,
      },
    ];

    renderWithProviders(<AIInsightsPanel mode="detail" role="agent" ticketId="t-1" />, {
      preloadedState: { auth: AGENT_AUTH },
      mocks,
    });

    await user.click(screen.getByRole('button', { name: /summarize thread/i }));

    await waitFor(() => {
      expect(screen.getByText(/VPN failure/i)).toBeInTheDocument();
    });
  });
});
