import { verify } from '../services/jwt.js';

const UNAUTHENTICATED_RESPONSE = {
  errors: [{ message: 'Unauthenticated', extensions: { code: 'UNAUTHENTICATED' } }],
};

/**
 * AuthMiddleware — applied to the /graphql route only.
 *
 * Extracts the Bearer token from the Authorization header, validates it via
 * JWTService, and attaches the decoded user context to req.user so the Apollo
 * context function can forward it to resolvers.
 *
 * Responds with a GraphQL-format UNAUTHENTICATED error for missing or invalid
 * tokens — before the request reaches Apollo Server. Public routes (/auth/*)
 * bypass this middleware entirely.
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization ?? '';

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json(UNAUTHENTICATED_RESPONSE);
  }

  const token = authHeader.slice(7);

  try {
    req.user = verify(token);
    return next();
  } catch {
    return res.status(401).json(UNAUTHENTICATED_RESPONSE);
  }
}
