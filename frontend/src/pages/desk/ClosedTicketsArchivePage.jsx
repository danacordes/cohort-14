import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { QUEUE_TICKETS } from '../../graphql/tickets.js';
import { selectRole } from '../../store/authSlice.js';

export default function ClosedTicketsArchivePage() {
  const navigate = useNavigate();
  const role = useSelector(selectRole);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const deskOk = role === 'agent' || role === 'admin';

  const variables = useMemo(
    () => ({
      filter: {
        status: 'CLOSED',
        ...(appliedSearch.trim() ? { search: appliedSearch.trim() } : {}),
      },
      sort: { field: 'updated_at', direction: 'DESC' },
      page,
      pageSize,
    }),
    [appliedSearch, page, pageSize]
  );

  const { data, loading, error } = useQuery(QUEUE_TICKETS, {
    variables,
    skip: !deskOk,
  });

  if (!deskOk) {
    return <Navigate to="/" replace />;
  }

  const edges = data?.tickets?.edges ?? [];
  const totalCount = data?.tickets?.totalCount ?? 0;

  function applySearch() {
    setAppliedSearch(searchInput);
    setPage(1);
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Closed ticket archive
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Keyword search across title, description, and resolution summary (read-only).
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <TextField
            size="small"
            label="Search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applySearch();
            }}
            sx={{ flex: 1, minWidth: 200 }}
          />
          <Button variant="contained" onClick={applySearch}>
            Search
          </Button>
        </Stack>
      </Paper>

      {loading && <Typography variant="body2">Loading…</Typography>}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not load closed tickets.
        </Alert>
      )}

      {!loading && !error && (
        <Paper variant="outlined" sx={{ overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Closed</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {edges.map(({ node: t }) => (
                <TableRow
                  key={t.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/tickets/${t.id}`)}
                >
                  <TableCell>#{t.publicNumber}</TableCell>
                  <TableCell sx={{ maxWidth: 420 }}>
                    <Typography variant="body2" noWrap>{t.title}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={t.priority} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {t.updatedAt ?? t.createdAt}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!edges.length && (
            <Box sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary">
                No closed tickets match this search.
              </Typography>
            </Box>
          )}

          <TablePagination
            component="div"
            count={totalCount}
            page={Math.max(0, page - 1)}
            onPageChange={(_e, newPage) => setPage(newPage + 1)}
            rowsPerPage={pageSize}
            rowsPerPageOptions={[10, 25, 50]}
            onRowsPerPageChange={(e) => {
              setPageSize(parseInt(e.target.value, 10));
              setPage(1);
            }}
          />
        </Paper>
      )}
    </Box>
  );
}
