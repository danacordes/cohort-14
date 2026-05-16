import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import AuditLogView from './AuditLogView.jsx';
import { renderWithProviders } from '../test/renderWithProviders.jsx';
import { AUDIT_LOG } from '../graphql/audit.js';

const USER_AUTH = {
  isAuthenticated: true,
  token: 'tok-u',
  user: {
    role: 'user',
    email: 'u@test.com',
    sub: 'u1',
    auth_method: 'password',
  },
};

const AGENT_AUTH = {
  isAuthenticated: true,
  token: 'tok-a',
  user: {
    role: 'agent',
    email: 'a@test.com',
    sub: 'a1',
    auth_method: 'password',
  },
};

function auditMock() {
  return {
    request: {
      query: AUDIT_LOG,
      variables: {
        entityType: 'Ticket',
        entityId: 'tid-1',
        page: { page: 1, pageSize: 25 },
      },
    },
    result: {
      data: {
        auditLog: {
          totalCount: 1,
          page: 1,
          pageSize: 25,
          items: [
            {
              id: 'ae1',
              entityType: 'Ticket',
              entityId: 'tid-1',
              action: 'created',
              actorId: 'actor-1',
              actorName: 'Agent Person',
              actorKind: 'HUMAN',
              aiConfidence: null,
              aiFeature: null,
              previousValues: '{}',
              newValues: JSON.stringify({ title: 'VPN down', priority: 'HIGH' }),
              occurredAt: '2026-01-02T12:00:00Z',
            },
          ],
        },
      },
    },
    delay: 0,
  };
}

describe('AuditLogView', () => {
  it('renders nothing for end users', () => {
    const { container } = renderWithProviders(
      <AuditLogView entityType="Ticket" entityId="tid-1" />,
      {
        preloadedState: { auth: USER_AUTH },
        mocks: [auditMock()],
      }
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows audit entries for agents', async () => {
    renderWithProviders(<AuditLogView entityType="Ticket" entityId="tid-1" />, {
      preloadedState: { auth: AGENT_AUTH },
      mocks: [auditMock()],
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /audit trail/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/created/i)).toBeInTheDocument();
    expect(screen.getByText(/Agent Person/)).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^Field$/i })).toBeInTheDocument();
  });
});
