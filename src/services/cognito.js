import { createRemoteJWKSet, jwtVerify } from 'jose';
import { randomUUID } from 'crypto';
import { ValidationError, AuthenticationError } from '../errors/index.js';

const {
  COGNITO_USER_POOL_ID,
  COGNITO_CLIENT_ID,
  COGNITO_DOMAIN,
  COGNITO_REDIRECT_URI,
  AWS_REGION = 'us-east-1',
} = process.env;

function issuerUrl() {
  return `https://cognito-idp.${AWS_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`;
}

function jwksUrl() {
  return new URL(`${issuerUrl()}/.well-known/jwks.json`);
}

// Lazily created — only needed when SSO path is exercised.
let _jwks = null;
function getJwks() {
  if (!_jwks) {
    _jwks = createRemoteJWKSet(jwksUrl());
  }
  return _jwks;
}

/**
 * Constructs the OAuth2 authorization URL for the Cognito Hosted UI.
 * @returns {string}
 */
export function buildAuthorizationUrl() {
  if (!COGNITO_DOMAIN || !COGNITO_CLIENT_ID || !COGNITO_REDIRECT_URI) {
    throw new Error('Cognito env vars (COGNITO_DOMAIN, COGNITO_CLIENT_ID, COGNITO_REDIRECT_URI) are required');
  }
  const url = new URL(`${COGNITO_DOMAIN}/oauth2/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', COGNITO_CLIENT_ID);
  url.searchParams.set('redirect_uri', COGNITO_REDIRECT_URI);
  url.searchParams.set('scope', 'openid email profile');
  return url.toString();
}

/**
 * Exchanges an authorization code for Cognito tokens.
 * @param {string} code
 * @returns {Promise<{ id_token: string, access_token: string }>}
 */
export async function exchangeCode(code) {
  if (!COGNITO_DOMAIN || !COGNITO_CLIENT_ID || !COGNITO_REDIRECT_URI) {
    throw new Error('Cognito env vars required for token exchange');
  }
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: COGNITO_CLIENT_ID,
    redirect_uri: COGNITO_REDIRECT_URI,
    code,
  });

  const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new AuthenticationError(`Cognito token exchange failed: ${text}`);
  }

  return res.json();
}

/**
 * Validates a Cognito ID token and extracts claims.
 * Verifies signature (via JWKS), issuer, and expiry.
 *
 * @param {string} idToken
 * @returns {Promise<{ sub: string, email: string, [key: string]: unknown }>}
 */
export async function validateIdToken(idToken) {
  try {
    const { payload } = await jwtVerify(idToken, getJwks(), {
      issuer: issuerUrl(),
      audience: COGNITO_CLIENT_ID,
    });
    return payload;
  } catch (err) {
    throw new AuthenticationError(`Invalid Cognito token: ${err.message}`);
  }
}

/**
 * Provisions or retrieves a User record from the SSO claims.
 *
 * Lookup order:
 *   1. Match by sso_subject (returning user)
 *   2. Match by email (link existing password account to SSO)
 *   3. Create new user-role record
 *
 * Never overwrites admin-assigned roles on subsequent logins.
 *
 * @param {{ sub: string, email: string }} claims
 * @param {import('node:sqlite').DatabaseSync} db  write connection
 * @returns {{ id: string, email: string, role: string }}
 */
export function provisionUser(claims, db) {
  const { sub: ssoSubject, email } = claims;

  if (!email) {
    throw new ValidationError('Cognito token missing email claim');
  }

  // 1. Look up by sso_subject
  let user = db.prepare('SELECT id, email, role FROM users WHERE sso_subject = ?').get(ssoSubject);
  if (user) return user;

  // 2. Look up by email — link existing account
  const existing = db.prepare('SELECT id, email, role FROM users WHERE email = ?').get(email);
  if (existing) {
    db.prepare('UPDATE users SET sso_subject = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(ssoSubject, existing.id);
    return existing;
  }

  // 3. First SSO login — provision new user record
  const id = randomUUID();
  db.prepare(`
    INSERT INTO users (id, email, role, sso_subject)
    VALUES (?, ?, 'user', ?)
  `).run(id, email, ssoSubject);

  return { id, email, role: 'user' };
}
