import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing/react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../store/authSlice.js';
import errorsReducer from '../store/errorsSlice.js';
import kbReducer from '../store/kbSlice.js';
import reportingReducer from '../store/reportingSlice.js';
import theme from '../theme.js';

export function buildStore(preloadedState = {}) {
  return configureStore({
    reducer: {
      auth: authReducer,
      errors: errorsReducer,
      kb: kbReducer,
      reporting: reportingReducer,
    },
    preloadedState,
  });
}

export function renderWithProviders(
  ui,
  {
    preloadedState = {},
    store = buildStore(preloadedState),
    mocks = [],
    initialEntries = ['/'],
    ...renderOptions
  } = {}
) {
  function Wrapper({ children }) {
    return (
      <Provider store={store}>
        <MockedProvider mocks={mocks} addTypename={false}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <MemoryRouter initialEntries={initialEntries}>
              {children}
            </MemoryRouter>
          </ThemeProvider>
        </MockedProvider>
      </Provider>
    );
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
