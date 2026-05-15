import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, Events } from './notificationDispatcher.js';

describe('NotificationDispatcher', () => {
  it('exports all expected event constants', () => {
    assert.ok(Events.TICKET_CREATED);
    assert.ok(Events.TICKET_STATUS_CHANGED);
    assert.ok(Events.TICKET_ASSIGNED);
    assert.ok(Events.TICKET_RESOLVED);
    assert.ok(Events.TICKET_CLOSED);
  });

  it('dispatch does not throw for a valid event', () => {
    assert.doesNotThrow(() =>
      dispatch(Events.TICKET_CREATED, { ticketId: 'abc', submitterId: 'user-1' })
    );
  });

  it('dispatch does not throw when payload is omitted', () => {
    assert.doesNotThrow(() => dispatch(Events.TICKET_CLOSED));
  });

  it('dispatch does not throw for an unknown event name', () => {
    assert.doesNotThrow(() => dispatch('unknown.event', {}));
  });
});
