import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { SLA_CONFIG, UPDATE_SLA_CONFIG } from '../../graphql/sla.js';
import { selectRole } from '../../store/authSlice.js';

const PRIORITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/** Mirrors backend `slaConfigService` defaults when a priority row is missing. */
const FALLBACK_POLICY = {
  CRITICAL: { responseTimeHours: 1, resolutionTimeHours: 4 },
  HIGH: { responseTimeHours: 4, resolutionTimeHours: 8 },
  MEDIUM: { responseTimeHours: 8, resolutionTimeHours: 24 },
  LOW: { responseTimeHours: 24, resolutionTimeHours: 72 },
};

function mergePolicies(policies) {
  const map = Object.fromEntries((policies ?? []).map((p) => [p.priority, p]));
  return PRIORITY_ORDER.map((priority) => {
    const row = map[priority];
    const fb = FALLBACK_POLICY[priority] ?? FALLBACK_POLICY.MEDIUM;
    return {
      priority,
      responseTimeHours: row?.responseTimeHours ?? fb.responseTimeHours,
      resolutionTimeHours: row?.resolutionTimeHours ?? fb.resolutionTimeHours,
    };
  });
}

export default function SLAConfigPage() {
  const role = useSelector(selectRole);
  const [rows, setRows] = useState([]);
  const [escalationPct, setEscalationPct] = useState('');
  const [unassignedHrs, setUnassignedHrs] = useState('');
  const [localError, setLocalError] = useState('');

  const { data, loading, refetch } = useQuery(SLA_CONFIG, {
    skip: role !== 'admin',
  });

  const [updateSla, { loading: saving }] = useMutation(UPDATE_SLA_CONFIG, {
    onCompleted: () => {
      setLocalError('');
      refetch();
    },
    onError: (e) => {
      setLocalError(e.message ?? 'Could not save SLA configuration.');
    },
  });

  const cfg = data?.slaConfig;

  useEffect(() => {
    if (!cfg) return;
    setRows(mergePolicies(cfg.policies));
    setEscalationPct(String(cfg.escalationThresholdPercent));
    setUnassignedHrs(String(cfg.unassignedEscalationThresholdHours));
  }, [cfg]);

  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  function patchRow(priority, field, raw) {
    setRows((prev) =>
      prev.map((r) => (r.priority === priority ? { ...r, [field]: raw } : r))
    );
  }

  async function handleSave() {
    setLocalError('');
    const esc = parseInt(escalationPct, 10);
    const un = parseInt(unassignedHrs, 10);

    if (!Number.isInteger(esc) || esc < 50 || esc > 95) {
      setLocalError('Escalation warning threshold must be an integer between 50 and 95 (percent).');
      return;
    }
    if (!Number.isInteger(un) || un < 1) {
      setLocalError('Unassigned escalation threshold must be a positive integer (hours).');
      return;
    }

    const policies = [];
    for (const r of rows) {
      const resp = parseInt(String(r.responseTimeHours), 10);
      const res = parseInt(String(r.resolutionTimeHours), 10);
      if (!Number.isInteger(resp) || resp < 1) {
        setLocalError(`${r.priority}: response hours must be a positive integer.`);
        return;
      }
      if (!Number.isInteger(res) || res <= resp) {
        setLocalError(`${r.priority}: resolution hours must be greater than response hours.`);
        return;
      }
      policies.push({
        priority: r.priority,
        responseTimeHours: resp,
        resolutionTimeHours: res,
      });
    }

    await updateSla({
      variables: {
        input: {
          policies,
          escalationThresholdPercent: esc,
          unassignedEscalationThresholdHours: un,
        },
      },
    });
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 920, mx: 'auto' }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        SLA configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Targets apply to tickets created after each save. Tickets already open keep their existing SLA clocks.
      </Typography>

      <Alert severity="warning" sx={{ mb: 2 }}>
        Saving changes here does not retroactively change due dates on in-flight tickets — only new submissions pick up the updated targets.
      </Alert>

      {localError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLocalError('')}>
          {localError}
        </Alert>
      )}

      {loading && !cfg && <Typography variant="body2">Loading…</Typography>}

      {cfg && (
        <>
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Global escalation settings
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
              <TextField
                label="Warning threshold (% of SLA elapsed)"
                type="number"
                size="small"
                inputProps={{ min: 50, max: 95 }}
                value={escalationPct}
                onChange={(e) => setEscalationPct(e.target.value)}
                helperText="Whole percent between 50 and 95."
              />
              <TextField
                label="Unassigned escalation (hours)"
                type="number"
                size="small"
                inputProps={{ min: 1 }}
                value={unassignedHrs}
                onChange={(e) => setUnassignedHrs(e.target.value)}
              />
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Targets by priority (hours)
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Priority</TableCell>
                  <TableCell>Response time</TableCell>
                  <TableCell>Resolution time</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.priority}>
                    <TableCell>{r.priority}</TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        size="small"
                        inputProps={{ min: 1 }}
                        value={r.responseTimeHours}
                        onChange={(e) => patchRow(r.priority, 'responseTimeHours', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        size="small"
                        inputProps={{ min: 2 }}
                        value={r.resolutionTimeHours}
                        onChange={(e) => patchRow(r.priority, 'resolutionTimeHours', e.target.value)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save SLA configuration'}
          </Button>
        </>
      )}
    </Box>
  );
}
