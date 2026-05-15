import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertTransitionAllowed } from './ticketStatus.js';

describe('assertTransitionAllowed — valid transitions', () => {
  it('allows OPEN → IN_PROGRESS for agent', () => {
    assert.doesNotThrow(() => assertTransitionAllowed('OPEN', 'IN_PROGRESS', 'agent'));
  });

  it('allows OPEN → IN_PROGRESS for admin', () => {
    assert.doesNotThrow(() => assertTransitionAllowed('OPEN', 'IN_PROGRESS', 'admin'));
  });

  it('allows IN_PROGRESS → PENDING_USER_RESPONSE for agent', () => {
    assert.doesNotThrow(() =>
      assertTransitionAllowed('IN_PROGRESS', 'PENDING_USER_RESPONSE', 'agent')
    );
  });

  it('allows PENDING_USER_RESPONSE → IN_PROGRESS for agent', () => {
    assert.doesNotThrow(() =>
      assertTransitionAllowed('PENDING_USER_RESPONSE', 'IN_PROGRESS', 'agent')
    );
  });

  it('allows IN_PROGRESS → RESOLVED for agent', () => {
    assert.doesNotThrow(() => assertTransitionAllowed('IN_PROGRESS', 'RESOLVED', 'agent'));
  });

  it('allows RESOLVED → CLOSED for agent', () => {
    assert.doesNotThrow(() => assertTransitionAllowed('RESOLVED', 'CLOSED', 'agent'));
  });

  it('allows RESOLVED → OPEN (reopen) for user', () => {
    assert.doesNotThrow(() => assertTransitionAllowed('RESOLVED', 'OPEN', 'user'));
  });

  it('allows CLOSED → OPEN (reopen) for user', () => {
    assert.doesNotThrow(() => assertTransitionAllowed('CLOSED', 'OPEN', 'user'));
  });
});

describe('assertTransitionAllowed — invalid transitions', () => {
  it('rejects OPEN → RESOLVED (skipping IN_PROGRESS)', () => {
    assert.throws(
      () => assertTransitionAllowed('OPEN', 'RESOLVED', 'agent'),
      { name: 'ValidationError' }
    );
  });

  it('rejects OPEN → CLOSED', () => {
    assert.throws(
      () => assertTransitionAllowed('OPEN', 'CLOSED', 'agent'),
      { name: 'ValidationError' }
    );
  });

  it('rejects CLOSED → IN_PROGRESS', () => {
    assert.throws(
      () => assertTransitionAllowed('CLOSED', 'IN_PROGRESS', 'admin'),
      { name: 'ValidationError' }
    );
  });

  it('rejects RESOLVED → PENDING_USER_RESPONSE', () => {
    assert.throws(
      () => assertTransitionAllowed('RESOLVED', 'PENDING_USER_RESPONSE', 'agent'),
      { name: 'ValidationError' }
    );
  });
});

describe('assertTransitionAllowed — role enforcement', () => {
  it('rejects user role from setting IN_PROGRESS', () => {
    assert.throws(
      () => assertTransitionAllowed('OPEN', 'IN_PROGRESS', 'user'),
      { name: 'ForbiddenError' }
    );
  });

  it('rejects user role from setting RESOLVED', () => {
    assert.throws(
      () => assertTransitionAllowed('IN_PROGRESS', 'RESOLVED', 'user'),
      { name: 'ForbiddenError' }
    );
  });

  it('rejects user role from setting CLOSED', () => {
    assert.throws(
      () => assertTransitionAllowed('RESOLVED', 'CLOSED', 'user'),
      { name: 'ForbiddenError' }
    );
  });

  it('allows admin to reopen a CLOSED ticket', () => {
    assert.doesNotThrow(() => assertTransitionAllowed('CLOSED', 'OPEN', 'admin'));
  });
});
