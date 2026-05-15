import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  from,
} from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { setContext } from '@apollo/client/link/context';
import store from '../store/index.js';
import {
  addError,
  setNetworkError,
  clearErrors,
} from '../store/errorsSlice.js';
import { logout } from '../store/authSlice.js';

const httpLink = new HttpLink({
  uri: import.meta.env.VITE_GRAPHQL_URL ?? 'http://localhost:4000/graphql',
});

// Reads the token from Redux state so it always reflects the current session,
// including immediately after logout clears the token.
const authLink = setContext((_, { headers }) => {
  const token = store.getState().auth.token;
  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (networkError) {
    store.dispatch(setNetworkError(true));
    return;
  }

  store.dispatch(setNetworkError(false));

  if (graphQLErrors) {
    for (const { message, extensions } of graphQLErrors) {
      const code = extensions?.code;

      if (code === 'UNAUTHENTICATED') {
        store.dispatch(logout());
        store.dispatch(clearErrors());
        window.location.replace('/login');
        return;
      }

      if (code === 'FORBIDDEN') {
        store.dispatch(
          addError({ code, message: 'You do not have permission to perform this action.' })
        );
        continue;
      }

      if (code === 'NOT_FOUND') {
        store.dispatch(addError({ code, message: message ?? 'Resource not found.' }));
        continue;
      }

      store.dispatch(
        addError({ code: code ?? 'ERROR', message: 'Something went wrong. Please try again.' })
      );
    }
  }
});

const client = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' },
  },
});

export default client;
