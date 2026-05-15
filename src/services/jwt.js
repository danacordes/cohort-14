import jwt from 'jsonwebtoken';
import { AuthenticationError } from '../errors/index.js';

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '8h';

if (!SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

/**
 * Signs a JWT for the given user.
 * Payload: { sub, email, role, auth_method, iat, exp }
 *
 * @param {{ id: string, email: string, role: string }} user
 * @param {'password'|'cognito'} authMethod
 * @returns {string} signed JWT
 */
export function sign(user, authMethod) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      auth_method: authMethod,
    },
    SECRET,
    { expiresIn: EXPIRES_IN }
  );
}

/**
 * Verifies and decodes a JWT.
 * Throws AuthenticationError on invalid signature, expiry, or malformed token.
 *
 * @param {string} token
 * @returns {{ sub: string, email: string, role: string, auth_method: string, iat: number, exp: number }}
 */
export function verify(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    throw new AuthenticationError('Invalid or expired token');
  }
}
