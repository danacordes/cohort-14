import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret-for-unit-tests';
process.env.JWT_EXPIRES_IN = '1h';

const { sign } = await import('../services/jwt.js');
const { authMiddleware } = await import('./auth.js');

function makeReqRes(authHeader) {
  const req = { headers: {} };
  if (authHeader !== undefined) req.headers.authorization = authHeader;

  let statusCode = null;
  let responseBody = null;
  let nextCalled = false;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  const next = () => { nextCalled = true; };

  return { req, res, next, getStatus: () => statusCode, getBody: () => responseBody, wasNext: () => nextCalled };
}

const TEST_USER = { id: 'u1', email: 'agent@test.com', role: 'agent' };

describe('authMiddleware', () => {
  it('calls next() and sets req.user for a valid Bearer token', () => {
    const token = sign(TEST_USER, 'password');
    const { req, res, next, getStatus, wasNext } = makeReqRes(`Bearer ${token}`);
    authMiddleware(req, res, next);
    assert.equal(wasNext(), true);
    assert.equal(getStatus(), null);
    assert.equal(req.user.sub, 'u1');
    assert.equal(req.user.email, 'agent@test.com');
    assert.equal(req.user.role, 'agent');
  });

  it('returns 401 when Authorization header is missing', () => {
    const { req, res, next, getStatus, getBody, wasNext } = makeReqRes(undefined);
    authMiddleware(req, res, next);
    assert.equal(wasNext(), false);
    assert.equal(getStatus(), 401);
    assert.equal(getBody().errors[0].extensions.code, 'UNAUTHENTICATED');
  });

  it('returns 401 when Authorization header does not start with "Bearer "', () => {
    const { req, res, next, getStatus, wasNext } = makeReqRes('Basic dXNlcjpwYXNz');
    authMiddleware(req, res, next);
    assert.equal(wasNext(), false);
    assert.equal(getStatus(), 401);
  });

  it('returns 401 when token is expired or tampered', () => {
    const token = sign(TEST_USER, 'password');
    const [h, p, _sig] = token.split('.');
    const tampered = `Bearer ${h}.${p}.badsig`;
    const { req, res, next, getStatus, wasNext } = makeReqRes(tampered);
    authMiddleware(req, res, next);
    assert.equal(wasNext(), false);
    assert.equal(getStatus(), 401);
  });

  it('response body contains GraphQL-format error', () => {
    const { req, res, next, getBody } = makeReqRes('Bearer invalid.token.here');
    authMiddleware(req, res, next);
    const body = getBody();
    assert.ok(Array.isArray(body.errors));
    assert.equal(body.errors[0].message, 'Unauthenticated');
    assert.equal(body.errors[0].extensions.code, 'UNAUTHENTICATED');
  });
});
