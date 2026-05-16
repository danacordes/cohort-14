import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import SLAConfigPage from './SLAConfigPage.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';
import { SLA_CONFIG } from '../../graphql/sla.js';

const ADMIN_AUTH = {
  isAuthenticated: true,
  token: 'tok',
  user: {
    role: 'admin',
    email: 'a@test.com',
    sub: 'a1',
    auth_method: 'password',
  },
};

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

function policyRow(priority, r, res) {
  return {
    id: `id-${priority}`,
    priority,
    responseTimeHours: r,
    resolutionTimeHours: res,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function slaConfigMock() {
  return {
    request: { query: SLA_CONFIG },
    result: {
      data: {
        slaConfig: {
          escalationThresholdPercent: 80,
          unassignedEscalationThresholdHours: 4,
          policies: [
            policyRow('CRITICAL', 1, 4),
            policyRow('HIGH', 4, 8),
            policyRow('MEDIUM', 8, 24),
            policyRow('LOW', 24, 72),
          ],
        },
      },
    },
    delay: 0,
  };
}

function Harness() {
  return (
    <Routes>
      <Route path="/desk/sla" element={<SLAConfigPage />} />
      <Route path="/" element={<Typography>Home shortcut</Typography>} />
    </Routes>
  );
}

describe('SLAConfigPage', () => {
  it('redirects non-admin users', async () => {
    renderWithProviders(<Harness />, {
      preloadedState: { auth: USER_AUTH },
      initialEntries: ['/desk/sla'],
    });
    await waitFor(() => {
      expect(screen.getByText('Home shortcut')).toBeInTheDocument();
    });
  });

  it('loads SLA configuration for admins', async () => {
    renderWithProviders(<Harness />, {
      preloadedState: { auth: ADMIN_AUTH },
      mocks: [slaConfigMock()],
      initialEntries: ['/desk/sla'],
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sla configuration/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('columnheader', { name: /^Priority$/i })).toBeInTheDocument();
  });
});
