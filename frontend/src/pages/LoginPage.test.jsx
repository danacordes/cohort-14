import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders.jsx';
import LoginPage from './LoginPage.jsx';

// Stub fetch globally
function stubFetch(response) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: response.ok ?? true,
    json: async () => response.body ?? {},
  });
}

describe('LoginPage', () => {

  it('renders email, password fields and sign-in button', () => {
    renderWithProviders(<LoginPage />, {
      preloadedState: { auth: { isAuthenticated: false, token: null, user: null } },
      initialEntries: ['/login'],
    });
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in$/i })).toBeInTheDocument();
  });

  it('renders the SSO button', () => {
    renderWithProviders(<LoginPage />, {
      preloadedState: { auth: { isAuthenticated: false, token: null, user: null } },
      initialEntries: ['/login'],
    });
    expect(screen.getByRole('button', { name: /sign in with sso/i })).toBeInTheDocument();
  });

  it('disables submit when fields are empty', () => {
    renderWithProviders(<LoginPage />, {
      preloadedState: { auth: { isAuthenticated: false, token: null, user: null } },
      initialEntries: ['/login'],
    });
    expect(screen.getByRole('button', { name: /sign in$/i })).toBeDisabled();
  });

  it('enables submit once email and password are filled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, {
      preloadedState: { auth: { isAuthenticated: false, token: null, user: null } },
      initialEntries: ['/login'],
    });
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'password');
    expect(screen.getByRole('button', { name: /sign in$/i })).toBeEnabled();
  });

  it('shows an error alert when the server returns 401', async () => {
    stubFetch({ ok: false, body: { error: 'Invalid credentials' } });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, {
      preloadedState: { auth: { isAuthenticated: false, token: null, user: null } },
      initialEntries: ['/login'],
    });
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in$/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
    });
  });

  it('shows a generic error when fetch throws (network down)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, {
      preloadedState: { auth: { isAuthenticated: false, token: null, user: null } },
      initialEntries: ['/login'],
    });
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'pass');
    await user.click(screen.getByRole('button', { name: /sign in$/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/unable to reach/i);
    });
  });
});
