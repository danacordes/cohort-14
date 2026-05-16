import { useMemo, useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import {
  auditFieldKeys,
  formatAuditScalar,
  humanizeAuditAction,
  parseAuditValues,
} from '../auditDisplay.js';
import { AUDIT_LOG } from '../graphql/audit.js';
import { selectRole } from '../store/authSlice.js';

function ActorLine({ actorName, actorId }) {
  const label = actorName?.trim()
    ? actorName
    : actorId && actorId.length > 14
      ? `${actorId.slice(0, 10)}…`
      : actorId ?? '—';
  return (
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
  );
}

function EntryChanges({ previousValues, newValues }) {
  const prevObj = parseAuditValues(previousValues);
  const nextObj = parseAuditValues(newValues);
  const keys = auditFieldKeys(previousValues, newValues);

  if (!keys.length && previousValues === newValues && (!previousValues || String(previousValues).trim() === '')) {
    return (
      <Typography variant="caption" color="text.secondary">
        No field payload recorded.
      </Typography>
    );
  }

  if (!keys.length) {
    const pv = typeof previousValues === 'string' ? previousValues : '';
    const nv = typeof newValues === 'string' ? newValues : '';
    return (
      <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', m: 0 }}>
        {pv || nv ? `${pv.slice(0, 200)} → ${nv.slice(0, 200)}` : '—'}
      </Typography>
    );
  }

  return (
    <Table size="small" sx={{ mt: 1 }}>
      <TableHead>
        <TableRow>
          <TableCell>Field</TableCell>
          <TableCell>Before</TableCell>
          <TableCell>After</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {keys.map((key) => (
          <TableRow key={key}>
            <TableCell sx={{ fontFamily: 'monospace', verticalAlign: 'top' }}>{key}</TableCell>
            <TableCell sx={{ verticalAlign: 'top', wordBreak: 'break-word' }}>
              {formatAuditScalar(prevObj[key])}
            </TableCell>
            <TableCell sx={{ verticalAlign: 'top', wordBreak: 'break-word' }}>
              {formatAuditScalar(nextObj[key])}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Paginated audit trail for any entity exposed via `auditLog`.
 * Hidden entirely for role `user` (no empty shell).
 *
 * @param {{ entityType: string; entityId: string }} props
 */
export default function AuditLogView({ entityType, entityId }) {
  const role = useSelector(selectRole);
  const deskOk = role === 'agent' || role === 'admin';

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const variables = useMemo(
    () => ({
      entityType,
      entityId,
      page: { page, pageSize },
    }),
    [entityType, entityId, page, pageSize]
  );

  const { data, loading, error } = useQuery(AUDIT_LOG, {
    skip: !deskOk || !entityType || !entityId,
    variables,
  });

  if (!deskOk) {
    return null;
  }

  const connection = data?.auditLog;
  const items = connection?.items ?? [];
  const totalCount = connection?.totalCount ?? 0;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Audit trail
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Immutable history for accountability (agents and admins only).
      </Typography>

      {loading && <Typography variant="body2">Loading audit entries…</Typography>}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not load audit log.
        </Alert>
      )}

      {!loading && !error && items.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No audit entries for this ticket yet.
        </Typography>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <Stack spacing={2}>
            {items.map((entry) => (
              <Paper key={entry.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" flexWrap="wrap" gap={1}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    {humanizeAuditAction(entry.action)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {entry.occurredAt}
                  </Typography>
                </Stack>
                <ActorLine actorName={entry.actorName} actorId={entry.actorId} />
                <EntryChanges previousValues={entry.previousValues} newValues={entry.newValues} />
              </Paper>
            ))}
          </Stack>

          <TablePagination
            component="div"
            count={totalCount}
            page={Math.max(0, page - 1)}
            onPageChange={(_e, next) => setPage(next + 1)}
            rowsPerPage={pageSize}
            rowsPerPageOptions={[10, 25, 50]}
            onRowsPerPageChange={(e) => {
              setPageSize(parseInt(e.target.value, 10));
              setPage(1);
            }}
          />
        </>
      )}
    </Paper>
  );
}
