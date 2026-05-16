import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client/react';
import { useDispatch, useSelector } from 'react-redux';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import SLAIndicator from '../../components/SLAIndicator.jsx';
import { TICKET_POLL_INTERVAL_MS } from '../../constants/ticketPolling.js';
import {
  AGENT_WORKLOAD,
  ASSIGN_TICKET,
  QUEUE_TICKETS,
  SELF_ASSIGN_TICKET,
  TICKET_CATEGORIES,
} from '../../graphql/tickets.js';
import { selectRole, selectUser } from '../../store/authSlice.js';
import {
  resetQueueFilters,
  selectTicketQueueState,
  setQueueFilter,
  setQueuePagination,
  setQueueSort,
} from '../../store/ticketQueueSlice.js';

const STATUSES = [
  '',
  'OPEN',
  'IN_PROGRESS',
  'PENDING_USER_RESPONSE',
  'RESOLVED',
  'CLOSED',
];
const PRIORITIES = ['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const SORT_FIELDS = [
  { value: 'created_at', label: 'Created' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
];

function formatTicketAge(iso) {
  if (!iso) return '—';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '—';
  const min = Math.floor((Date.now() - then) / 60000);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h`;
  const d = Math.floor(hr / 24);
  return `${d}d`;
}

function AssigneeCell({ assignedTo }) {
  if (!assignedTo) {
    return (
      <Typography variant="body2" color="warning.main" fontWeight={600}>
        Unassigned
      </Typography>
    );
  }
  return (
    <Typography variant="body2" fontFamily="monospace">
      {assignedTo.length > 16 ? `${assignedTo.slice(0, 14)}…` : assignedTo}
    </Typography>
  );
}

export default function TicketQueuePage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const role = useSelector(selectRole);
  const user = useSelector(selectUser);
  const qState = useSelector(selectTicketQueueState);

  const {
    status,
    priority,
    categoryId,
    assigneeFilter,
    search,
    sortField,
    sortDirection,
    page,
    pageSize,
  } = qState;

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTicketRow, setAssignTicketRow] = useState(null);
  const [assignAgentId, setAssignAgentId] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionBusyId, setActionBusyId] = useState(null);

  const deskDisabled = role === 'user' || !role;

  const filterVariables = useMemo(() => {
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (categoryId) filter.categoryId = categoryId;
    if (search.trim()) filter.search = search.trim();

    if (role === 'admin') {
      if (assigneeFilter === 'UNASSIGNED') filter.unassignedOnly = true;
      else if (assigneeFilter !== 'ALL') filter.assignedTo = assigneeFilter;
    }

    return filter;
  }, [role, status, priority, categoryId, assigneeFilter, search]);

  const queueVariables = useMemo(
    () => ({
      filter: filterVariables,
      sort: {
        field: sortField || 'created_at',
        direction: sortDirection || 'DESC',
      },
      page,
      pageSize,
    }),
    [filterVariables, sortField, sortDirection, page, pageSize]
  );

  const { data: catData } = useQuery(TICKET_CATEGORIES, { skip: deskDisabled });
  const { data: queueData, loading: queueLoading, error: queueError, refetch: refetchQueue } =
    useQuery(QUEUE_TICKETS, {
      skip: deskDisabled,
      variables: queueVariables,
      pollInterval: TICKET_POLL_INTERVAL_MS,
    });

  const { data: workloadData, refetch: refetchWorkload } = useQuery(AGENT_WORKLOAD, {
    skip: role !== 'admin',
  });

  const [assignTicket, { loading: assignLoading }] = useMutation(ASSIGN_TICKET, {
    onCompleted: async () => {
      setAssignOpen(false);
      setAssignTicketRow(null);
      setActionError('');
      await Promise.all([refetchQueue(), refetchWorkload()].filter(Boolean));
    },
    onError: (e) => {
      setActionError(e.message ?? 'Assignment failed.');
    },
  });

  const [selfAssignTicket] = useMutation(SELF_ASSIGN_TICKET, {
    onCompleted: async () => {
      setActionBusyId(null);
      setActionError('');
      await Promise.all([refetchQueue(), refetchWorkload()].filter(Boolean));
    },
    onError: (e) => {
      setActionBusyId(null);
      setActionError(e.message ?? 'Self-assign failed.');
    },
  });

  if (role === 'user' || !role) {
    return <Navigate to="/" replace />;
  }

  const categories = catData?.ticketCategories?.filter((c) => c.isActive !== false) ?? [];
  const edges = queueData?.tickets?.edges ?? [];
  const totalCount = queueData?.tickets?.totalCount ?? 0;
  const workloadAgents = workloadData?.agentWorkload ?? [];

  function openAssignDialog(row) {
    setActionError('');
    setAssignTicketRow(row);
    const first = workloadAgents[0]?.agentId ?? '';
    const current = row?.node?.assignedTo;
    setAssignAgentId(
      current && workloadAgents.some((a) => a.agentId === current) ? current : first
    );
    setAssignOpen(true);
  }

  function handleConfirmAssign() {
    if (!assignTicketRow || !assignAgentId) return;
    assignTicket({
      variables: {
        ticketId: assignTicketRow.node.id,
        agentId: assignAgentId,
      },
    });
  }

  function handleSelfAssign(ticketId) {
    setActionError('');
    setActionBusyId(ticketId);
    selfAssignTicket({ variables: { ticketId } });
  }

  const isAdmin = role === 'admin';
  const isAgent = role === 'agent';

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Service desk queue
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {isAdmin
          ? 'Full ticket queue with filters and assignment controls.'
          : 'Unassigned pool and tickets assigned to you. Claim tickets with Self-assign.'}
      </Typography>

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError('')}>
          {actionError}
        </Alert>
      )}

      {isAdmin && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom fontWeight={600}>
            Agent workload
          </Typography>
          {workloadAgents.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No agents in directory.</Typography>
          ) : (
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              {workloadAgents.map((row) => (
                <Paper key={row.agentId} variant="outlined" sx={{ px: 2, py: 1 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {row.agentName}
                  </Typography>
                  <Typography variant="h6">{row.openTicketCount}</Typography>
                  <Typography variant="caption" color="text.secondary">Open tickets</Typography>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom fontWeight={600}>
          Filters
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="tq-status-label">Status</InputLabel>
            <Select
              labelId="tq-status-label"
              label="Status"
              value={status}
              onChange={(e) => dispatch(setQueueFilter({ status: e.target.value }))}
            >
              <MenuItem value="">All statuses</MenuItem>
              {STATUSES.filter(Boolean).map((code) => (
                <MenuItem key={code} value={code}>{code.replace(/_/g, ' ')}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="tq-pri-label">Priority</InputLabel>
            <Select
              labelId="tq-pri-label"
              label="Priority"
              value={priority}
              onChange={(e) => dispatch(setQueueFilter({ priority: e.target.value }))}
            >
              <MenuItem value="">All priorities</MenuItem>
              {PRIORITIES.filter(Boolean).map((code) => (
                <MenuItem key={code} value={code}>{code}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="tq-cat-label">Category</InputLabel>
            <Select
              labelId="tq-cat-label"
              label="Category"
              value={categoryId}
              onChange={(e) => dispatch(setQueueFilter({ categoryId: e.target.value }))}
            >
              <MenuItem value="">All categories</MenuItem>
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {isAdmin && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="tq-assignee-label">Assignee</InputLabel>
              <Select
                labelId="tq-assignee-label"
                label="Assignee"
                value={assigneeFilter}
                onChange={(e) => dispatch(setQueueFilter({ assigneeFilter: e.target.value }))}
              >
                <MenuItem value="ALL">Everyone</MenuItem>
                <MenuItem value="UNASSIGNED">Unassigned only</MenuItem>
                {workloadAgents.map((a) => (
                  <MenuItem key={a.agentId} value={a.agentId}>{a.agentName}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField
            size="small"
            label="Search"
            value={search}
            placeholder="Title, description…"
            onChange={(e) => dispatch(setQueueFilter({ search: e.target.value }))}
            sx={{ minWidth: 220 }}
          />

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="tq-sort-field-label">Sort by</InputLabel>
            <Select
              labelId="tq-sort-field-label"
              label="Sort by"
              value={sortField}
              onChange={(e) => dispatch(setQueueSort({ sortField: e.target.value }))}
            >
              {SORT_FIELDS.map((sf) => (
                <MenuItem key={sf.value} value={sf.value}>{sf.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel id="tq-sort-dir-label">Order</InputLabel>
            <Select
              labelId="tq-sort-dir-label"
              label="Order"
              value={sortDirection}
              onChange={(e) => dispatch(setQueueSort({ sortDirection: e.target.value }))}
            >
              <MenuItem value="DESC">Newest first</MenuItem>
              <MenuItem value="ASC">Oldest first</MenuItem>
            </Select>
          </FormControl>

          <Button variant="outlined" onClick={() => dispatch(resetQueueFilters())}>
            Reset filters
          </Button>
        </Stack>
      </Paper>

      {queueLoading && <Typography variant="body2">Loading…</Typography>}
      {queueError && (
        <Alert severity="error" sx={{ mb: 2 }}>Could not load queue.</Alert>
      )}

      {!queueLoading && !queueError && (
        <>
          <Paper variant="outlined" sx={{ overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>SLA</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Assignee</TableCell>
                  <TableCell>Age</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {edges.map(({ node: t }) => (
                  <TableRow
                    key={t.id}
                    hover
                    sx={{
                      cursor: 'pointer',
                      bgcolor: !t.assignedTo
                        ? alpha(theme.palette.warning.main, theme.palette.mode === 'dark' ? 0.12 : 0.18)
                        : user?.sub && t.assignedTo === user.sub
                          ? alpha(theme.palette.primary.main, 0.1)
                          : undefined,
                    }}
                    onClick={() => navigate(`/tickets/${t.id}`)}
                  >
                    <TableCell>#{t.publicNumber}</TableCell>
                    <TableCell sx={{ maxWidth: 320 }}>
                      <Typography variant="body2" noWrap>{t.title}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={t.status} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t.priority}
                        size="small"
                        variant="outlined"
                        {...(t.priority === 'CRITICAL' ? { color: 'error' } : {})}
                      />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <SLAIndicator dense {...t} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{t.category?.name ?? '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <AssigneeCell assignedTo={t.assignedTo} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {formatTicketAge(t.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                        {isAgent && !t.assignedTo && (
                          <Button
                            size="small"
                            variant="contained"
                            disabled={actionBusyId === t.id}
                            onClick={() => handleSelfAssign(t.id)}
                          >
                            Self-assign
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => openAssignDialog({ node: t })}
                          >
                            Assign
                          </Button>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {!edges.length && (
              <Box sx={{ p: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  No tickets match the current filters.
                </Typography>
              </Box>
            )}

            <TablePagination
              component="div"
              count={totalCount}
              page={Math.max(0, page - 1)}
              onPageChange={(_e, newPage) => {
                dispatch(setQueuePagination({ page: newPage + 1 }));
              }}
              rowsPerPage={pageSize}
              rowsPerPageOptions={[10, 25, 50]}
              onRowsPerPageChange={(e) => {
                dispatch(setQueuePagination({ page: 1, pageSize: parseInt(e.target.value, 10) }));
              }}
            />
          </Paper>
        </>
      )}

      <Dialog open={assignOpen} onClose={() => !assignLoading && setAssignOpen(false)}>
        <DialogTitle>
          Assign ticket #{assignTicketRow?.node.publicNumber ?? ''}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Pick an agent with the agent role (from directory).
          </Typography>
          <FormControl fullWidth size="small" sx={{ minWidth: 280 }}>
            <InputLabel id="assign-agent-label">Agent</InputLabel>
            <Select
              labelId="assign-agent-label"
              label="Agent"
              value={assignAgentId}
              onChange={(e) => setAssignAgentId(e.target.value)}
            >
              {workloadAgents.map((a) => (
                <MenuItem key={a.agentId} value={a.agentId}>
                  {a.agentName} ({a.openTicketCount} open)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignOpen(false)} disabled={assignLoading}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirmAssign}
            disabled={assignLoading || !assignAgentId}
          >
            {assignLoading ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
