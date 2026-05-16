import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VirtualAgentView from './VirtualAgentView.jsx';
import { renderWithProviders } from '../test/renderWithProviders.jsx';
import { VIRTUAL_AGENT } from '../graphql/ai.js';

const USER_AUTH = {
  isAuthenticated: true,
  token: 'tok',
  user: { role: 'user', email: 'u@test.com', sub: 'u1', auth_method: 'password' },
};

describe('VirtualAgentView', () => {
  it('shows assistant answer with source links', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: VIRTUAL_AGENT,
          variables: { query: 'reset vpn' },
        },
        result: {
          data: {
            virtualAgent: {
              answer: 'Reset the VPN from Settings.',
              sourceArticles: [
                { id: 'kb-1', number: 'KB-0001', title: 'VPN reset', status: 'Published' },
              ],
            },
          },
        },
        delay: 0,
      },
    ];

    renderWithProviders(<VirtualAgentView />, {
      preloadedState: { auth: USER_AUTH },
      mocks,
      initialEntries: ['/kb/assistant'],
    });

    await user.type(screen.getByLabelText(/your question/i), 'reset vpn');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/Reset the VPN/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /KB-0001: VPN reset/i })).toHaveAttribute(
      'href',
      '/kb/kb-1',
    );
    expect(screen.queryByRole('button', { name: /escalate to ticket/i })).not.toBeInTheDocument();
  });

  it('shows escalate when no source articles', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: VIRTUAL_AGENT,
          variables: { query: 'obscure payroll' },
        },
        result: {
          data: {
            virtualAgent: {
              answer: 'I could not find a matching article.',
              sourceArticles: [],
            },
          },
        },
        delay: 0,
      },
    ];

    renderWithProviders(<VirtualAgentView />, {
      preloadedState: { auth: USER_AUTH },
      mocks,
      initialEntries: ['/kb/assistant'],
    });

    await user.type(screen.getByLabelText(/your question/i), 'obscure payroll');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/could not find/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /escalate to ticket/i })).toBeInTheDocument();
  });
});
