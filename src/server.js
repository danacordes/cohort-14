import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { GraphQLError } from 'graphql';
import { typeDefs, resolvers } from './graphql/schema.js';
import authRouter from './routes/auth.js';

const isDev = process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT ?? 4000;

const KNOWN_CODES = new Set([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'INTERNAL_SERVER_ERROR',
]);

function formatError(formattedError, error) {
  const code = formattedError.extensions?.code;

  if (KNOWN_CODES.has(code) && code !== 'INTERNAL_SERVER_ERROR') {
    return formattedError;
  }

  const originalError = error instanceof GraphQLError ? error.originalError ?? error : error;

  if (isDev) {
    console.error('[GraphQL error]', originalError);
  } else {
    console.error(JSON.stringify({
      level: 'error',
      message: originalError?.message ?? 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString(),
    }));
  }

  return {
    message: 'Internal server error',
    extensions: { code: 'INTERNAL_SERVER_ERROR' },
  };
}

const apollo = new ApolloServer({
  typeDefs,
  resolvers,
  formatError,
  introspection: isDev,
});

await apollo.start();

const app = express();

const corsOptions = isDev
  ? { origin: 'http://localhost:5173', credentials: true }
  : { origin: process.env.FRONTEND_URL, credentials: true };

app.use(cors(corsOptions));
app.use(express.json());

app.use('/auth', authRouter);

app.use(
  '/graphql',
  cors(corsOptions),
  express.json(),
  expressMiddleware(apollo, {
    context: async ({ req }) => ({ req }),
  }),
);

app.listen(PORT, () => {
  if (isDev) {
    console.log(`Server ready at http://localhost:${PORT}/graphql`);
    console.log(`Apollo Sandbox: http://localhost:${PORT}/graphql`);
  } else {
    console.log(JSON.stringify({
      level: 'info',
      message: `Server started`,
      port: PORT,
      timestamp: new Date().toISOString(),
    }));
  }
});
