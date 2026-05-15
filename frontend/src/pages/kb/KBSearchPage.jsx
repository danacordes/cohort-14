import { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useLazyQuery } from '@apollo/client/react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  InputAdornment,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  FormControl,
  InputLabel,
} from '@mui/material';
import { KB_SEARCH } from '../../graphql/kb.js';
import {
  setSearchResults,
  setSearchQuery,
  setSearchFilters,
  setSearchPage,
  setLoading,
  setError,
  selectSearchResults,
  selectSearchMeta,
  selectKBLoading,
  selectKBError,
} from '../../store/kbSlice.js';

const ARTICLE_TYPES = ['Solution', 'How-To Guide', 'Known Error', 'FAQ'];
const STATUSES = ['Published', 'Draft', 'PendingReview', 'Retired', 'Archived', 'Expired'];

function StatusBadge({ status }) {
  const colorMap = {
    Published: 'success',
    Draft: 'default',
    PendingReview: 'warning',
    Retired: 'error',
    Archived: 'default',
    Expired: 'error',
  };
  return <Chip label={status} color={colorMap[status] ?? 'default'} size="small" />;
}

function ResultCard({ article, onClick }) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
      onClick={() => onClick(article.id)}
    >
      <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
        <Typography variant="caption" color="text.secondary">
          {article.number}
        </Typography>
        <StatusBadge status={article.status} />
        {article.articleType && (
          <Chip label={article.articleType} size="small" variant="outlined" />
        )}
      </Stack>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        {article.title}
      </Typography>
      {article.excerpt && (
        <Typography
          variant="body2"
          color="text.secondary"
          dangerouslySetInnerHTML={{ __html: article.excerpt }}
        />
      )}
      {article.category && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {article.category.name}
        </Typography>
      )}
    </Paper>
  );
}

export default function KBSearchPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const results = useSelector(selectSearchResults);
  const meta = useSelector(selectSearchMeta);
  const isLoading = useSelector(selectKBLoading('search'));
  const error = useSelector(selectKBError);

  const [localQuery, setLocalQuery] = useState(meta.query);
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('Published');
  const [hasSearched, setHasSearched] = useState(false);

  const [runSearch] = useLazyQuery(KB_SEARCH, {
    onCompleted(data) {
      dispatch(setSearchResults(data.kbSearch));
      dispatch(setLoading({ key: 'search', value: false }));
      setHasSearched(true);
    },
    onError(err) {
      dispatch(setError(err.message));
      dispatch(setLoading({ key: 'search', value: false }));
    },
    fetchPolicy: 'network-only',
  });

  const doSearch = useCallback(
    (query, page = 1) => {
      const filters = {};
      if (filterType) filters.articleType = filterType;
      if (filterStatus) filters.status = filterStatus;

      dispatch(setSearchQuery(query));
      dispatch(setSearchFilters(filters));
      dispatch(setSearchPage(page));
      dispatch(setLoading({ key: 'search', value: true }));

      runSearch({
        variables: {
          query,
          filters,
          page: { page, pageSize: meta.pageSize },
        },
      });
    },
    [dispatch, filterType, filterStatus, meta.pageSize, runSearch]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    doSearch(localQuery, 1);
  };

  const handlePageChange = (_, page) => {
    doSearch(meta.query, page);
  };

  const totalPages = Math.ceil(meta.totalCount / meta.pageSize);

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>
          Knowledge Base
        </Typography>
        <Button variant="contained" onClick={() => navigate('/kb/new')}>
          New Article
        </Button>
      </Stack>

      <Paper component="form" onSubmit={handleSubmit} sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1}>
          <TextField
            fullWidth
            placeholder="Search articles…"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start">🔍</InputAdornment>,
            }}
            size="small"
          />
          <Button type="submit" variant="contained" disabled={isLoading} sx={{ minWidth: 90 }}>
            {isLoading ? <CircularProgress size={18} color="inherit" /> : 'Search'}
          </Button>
          <Button variant="outlined" onClick={() => setShowFilters((v) => !v)} size="small">
            Filters
          </Button>
        </Stack>

        <Collapse in={showFilters}>
          <Divider sx={{ my: 2 }} />
          <Stack direction="row" spacing={2}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Article Type</InputLabel>
              <Select
                label="Article Type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <MenuItem value="">All types</MenuItem>
                {ARTICLE_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="">All statuses</MenuItem>
                {STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Collapse>
      </Paper>

      {error && (
        <Typography color="error" mb={2}>{error}</Typography>
      )}

      {hasSearched && results.length === 0 && !isLoading && (
        <Box textAlign="center" py={6}>
          <Typography variant="h6" gutterBottom>No results found</Typography>
          {meta.suggestions.length > 0 && (
            <>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Try searching for:
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap">
                {meta.suggestions.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    clickable
                    onClick={() => {
                      setLocalQuery(s);
                      doSearch(s, 1);
                    }}
                  />
                ))}
              </Stack>
            </>
          )}
        </Box>
      )}

      <Stack spacing={1.5}>
        {results.map((article) => (
          <ResultCard
            key={article.id}
            article={article}
            onClick={(id) => navigate(`/kb/${id}`)}
          />
        ))}
      </Stack>

      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Pagination
            count={totalPages}
            page={meta.page}
            onChange={handlePageChange}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
}
