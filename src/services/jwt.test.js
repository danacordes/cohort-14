import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// Must set JWT_SECRET before the module is imported
process.env.JWT_SECRET = 'test-secret-for-unit-tests';
process.env.JWT_EXPIRES_IN = '1h';

const { sign, verify } = await import('./jwt.js');

const TEST_USER = { id: 'user-abc', email: 'test@example.com', role: 'agent' };

describe('jwt.sign', () => {
  it('returns a string with three dot-separated segments', () => {
    const token = sign(TEST_USER, 'password');
    assert.equal(typeof token, 'string');
    assert.equal(token.split('.').length, 3);
  });

  it('embeds the correct claims in the payload', () => {
    const token = sign(TEST_USER, 'cognito');
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    assert.equal(payload.sub, 'user-abc');
    assert.equal(payload.email, 'test@example.com');
    assert.equal(payload.role, 'agent');
    assert.equal(payload.auth_method, 'cognito');
  });

  it('includes exp claim', () => {
    const token = sign(TEST_USER, 'password');
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    assert.ok(payload.exp > Math.floor(Date.now() / 1000));
  });
});

describe('jwt.verify', () => {
  it('returns decoded payload for a valid token', () => {
    const token = sign(TEST_USER, 'password');
    const decoded = verify(token);
    assert.equal(decoded.sub, 'user-abc');
    assert.equal(decoded.email, 'test@example.com');
    assert.equal(decoded.role, 'agent');
  });

  it('throws AuthenticationError for a tampered token', () => {
    const token = sign(TEST_USER, 'password');
    const [h, p, _sig] = token.split('.');
    const tampered = `${h}.${p}.invalidsignature`;
    assert.throws(() => verify(tampered), /Invalid or expired token/);
  });

  it('throws AuthenticationError for a completely invalid string', () => {
    assert.throws(() => verify('not-a-jwt'), /Invalid or expired token/);
  });

  it('throws AuthenticationError for an empty string', () => {
    assert.throws(() => verify(''), /Invalid or expired token/);
  });
});
