import { describe, it, expect, vi } from 'vitest';
import authReducer, {
  loginSuccess,
  logout,
  ssoCallback,
  selectIsAuthenticated,
  selectUser,
  selectToken,
  selectRole,
} from './authSlice.js';

// Minimal valid JWT — unsigned but structurally correct for slice logic (decode only, no verify)
function makeToken(payload) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload)).replace(/=+$/, '');
  return `${header}.${body}.fakesig`;
}

const VALID_PAYLOAD = {
  sub: 'user-123',
  email: 'agent@example.com',
  role: 'agent',
  auth_method: 'local',
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const VALID_TOKEN = makeToken(VALID_PAYLOAD);

const emptyState = { token: null, user: null, isAuthenticated: false };

describe('authSlice reducers', () => {
  describe('initial state', () => {
    it('starts unauthenticated when no token is stored', () => {
      const state = authReducer(emptyState, { type: '@@INIT' });
      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
    });
  });

  describe('loginSuccess', () => {
    it('sets isAuthenticated to true', () => {
      const state = authReducer(emptyState, loginSuccess(VALID_TOKEN));
      expect(state.isAuthenticated).toBe(true);
    });

    it('stores the token in state', () => {
      const state = authReducer(emptyState, loginSuccess(VALID_TOKEN));
      expect(state.token).toBe(VALID_TOKEN);
    });

    it('populates user from JWT payload', () => {
      const state = authReducer(emptyState, loginSuccess(VALID_TOKEN));
      expect(state.user).toMatchObject({
        sub: 'user-123',
        email: 'agent@example.com',
        role: 'agent',
        auth_method: 'local',
      });
    });

    it('does not mutate state when given a malformed token', () => {
      const state = authReducer(emptyState, loginSuccess('not.a.jwt'));
      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();
    });
  });

  describe('logout', () => {
    it('clears isAuthenticated', () => {
      const loggedIn = authReducer(emptyState, loginSuccess(VALID_TOKEN));
      const state = authReducer(loggedIn, logout());
      expect(state.isAuthenticated).toBe(false);
    });

    it('clears token and user from state', () => {
      const loggedIn = authReducer(emptyState, loginSuccess(VALID_TOKEN));
      const state = authReducer(loggedIn, logout());
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
    });

  });

  describe('ssoCallback', () => {
    it('authenticates when hash contains a valid token', () => {
      const token = VALID_TOKEN;
      Object.defineProperty(window, 'location', {
        value: { hash: `#token=${encodeURIComponent(token)}`, pathname: '/auth/callback', search: '' },
        writable: true,
        configurable: true,
      });
      window.history = { replaceState: vi.fn() };

      const state = authReducer(emptyState, ssoCallback());
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe(token);
      expect(state.user?.email).toBe('agent@example.com');
    });

    it('does nothing when hash contains no token', () => {
      Object.defineProperty(window, 'location', {
        value: { hash: '#foo=bar', pathname: '/auth/callback', search: '' },
        writable: true,
        configurable: true,
      });
      const state = authReducer(emptyState, ssoCallback());
      expect(state.isAuthenticated).toBe(false);
    });
  });
});

describe('authSlice selectors', () => {
  it('selectIsAuthenticated returns false on empty state', () => {
    expect(selectIsAuthenticated({ auth: emptyState })).toBe(false);
  });

  it('selectUser returns null on empty state', () => {
    expect(selectUser({ auth: emptyState })).toBeNull();
  });

  it('selectToken returns null on empty state', () => {
    expect(selectToken({ auth: emptyState })).toBeNull();
  });

  it('selectRole returns null when user is null', () => {
    expect(selectRole({ auth: emptyState })).toBeNull();
  });

  it('selectRole returns the role when authenticated', () => {
    const loggedIn = authReducer(emptyState, loginSuccess(VALID_TOKEN));
    expect(selectRole({ auth: loggedIn })).toBe('agent');
  });
});
