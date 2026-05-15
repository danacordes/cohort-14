import { createSlice } from '@reduxjs/toolkit';

const TOKEN_KEY = 'authToken';

// Safe accessor — prefers window.localStorage (always set by jsdom/browser) over the
// bare global which Node.js v22 experimental Web Storage can set to undefined.
const storage = (() => {
  try {
    const s =
      (typeof window !== 'undefined' && window.localStorage) ||
      (typeof localStorage !== 'undefined' && localStorage) ||
      null;
    if (s && typeof s.getItem === 'function') return s;
  } catch { /* ignore */ }
  return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
})();

function decodePayload(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

function loadInitialState() {
  const token = storage.getItem(TOKEN_KEY);
  if (!token) return { token: null, user: null, isAuthenticated: false };
  const payload = decodePayload(token);
  if (!payload) {
    storage.removeItem(TOKEN_KEY);
    return { token: null, user: null, isAuthenticated: false };
  }
  // Treat expired tokens as unauthenticated — UNAUTHENTICATED error path handles cleanup
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    storage.removeItem(TOKEN_KEY);
    return { token: null, user: null, isAuthenticated: false };
  }
  return {
    token,
    user: {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      auth_method: payload.auth_method,
    },
    isAuthenticated: true,
  };
}

const authSlice = createSlice({
  name: 'auth',
  initialState: loadInitialState(),
  reducers: {
    loginSuccess(state, action) {
      const token = action.payload;
      const payload = decodePayload(token);
      if (!payload) return;
      storage.setItem(TOKEN_KEY, token);
      state.token = token;
      state.user = {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
        auth_method: payload.auth_method,
      };
      state.isAuthenticated = true;
    },

    ssoCallback(state) {
      const hash = window.location.hash;
      const match = hash.match(/[#&]token=([^&]+)/);
      if (!match) return;
      const token = decodeURIComponent(match[1]);
      const payload = decodePayload(token);
      if (!payload) return;
      storage.setItem(TOKEN_KEY, token);
      state.token = token;
      state.user = {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
        auth_method: payload.auth_method,
      };
      state.isAuthenticated = true;
      // Clear the hash fragment from the browser URL without triggering navigation
      if (typeof window !== 'undefined' && window.history) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    },

    logout(state) {
      storage.removeItem(TOKEN_KEY);
      state.token = null;
      state.user = null;
      state.isAuthenticated = false;
    },
  },
});

export const { loginSuccess, ssoCallback, logout } = authSlice.actions;

export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectUser = (state) => state.auth.user;
export const selectRole = (state) => state.auth.user?.role ?? null;
export const selectToken = (state) => state.auth.token;

export default authSlice.reducer;
