import { useEffect, useRef, useState, useMemo } from 'react';
import { Link as RRLink } from 'react-router-dom';
import { useLazyQuery, useMutation } from '@apollo/client/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { KB_SEARCH } from '../../graphql/kb.js';
import { RECORD_DEFLECTION } from '../../graphql/tickets.js';

const DEBOUNCE_MS = 350;

export default function KBDeflectionPanel({
  title,
  description,
  collapsed,
  onCollapse,
  onResolved,
}) {
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState(null);
  const timerRef = useRef(null);

  const queryText = useMemo(
    () => `${title ?? ''}\n${description ?? ''}`.trim(),
    [title, description]
  );

  const [runKbSearch, { loading }] = useLazyQuery(KB_SEARCH, {
    fetchPolicy: 'network-only',
    onCompleted(data) {
      setResults(data?.kbSearch?.items ?? []);
      setSearchError(null);
    },
    onError(err) {
      setResults([]);
      setSearchError(err.message);
    },
  });

  useEffect(() => {
    if (collapsed) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      if (queryText.length < 3) {
        setResults([]);
        setSearchError(null);
        return;
      }
      runKbSearch({
        variables: {
          query: queryText,
          filters: { status: 'Published' },
          page: { page: 1, pageSize: 5 },
        },
      });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [queryText, collapsed, runKbSearch]);

  const [recordDeflection, { loading: saving }] = useMutation(RECORD_DEFLECTION, {
    onCompleted() {
      onResolved?.();
    },
    onError() {
      setSearchError('Could not record self-resolution. You can still submit a ticket.');
    },
  });

  function handleResolved(article) {
    recordDeflection({
      variables: {
        articleId: article.id,
        queryText,
      },
    });
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          Related knowledge base articles
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={onCollapse}>
            {collapsed ? 'Show suggestions' : 'Dismiss suggestions'}
          </Button>
        </Stack>
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Suggestions appear as you type. You can ignore them and submit your ticket anytime.
      </Typography>

      <Collapse in={!collapsed}>
        {loading && (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={24} />
          </Box>
        )}

        {searchError && !loading && (
          <Typography variant="body2" color="text.secondary">
            KB suggestions unavailable. You can still submit your ticket.
          </Typography>
        )}

        {!loading && !searchError && queryText.length < 3 && (
          <Typography variant="body2" color="text.secondary">
            Keep typing — we&apos;ll suggest articles once there is enough text.
          </Typography>
        )}

        {!loading && results.length === 0 && queryText.length >= 3 && !searchError && (
          <Typography variant="body2" color="text.secondary">
            No matching articles yet. Continue with your ticket if you still need help.
          </Typography>
        )}

        <Stack spacing={1.5} mt={1}>
          {results.map((article) => (
            <Paper key={article.id} variant="outlined" sx={{ p: 1.5 }}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                <Box flex={1} minWidth={0}>
                  <Stack direction="row" spacing={1} alignItems="center" mb={0.5} flexWrap="wrap">
                    <Typography variant="caption" color="text.secondary">
                      {article.number}
                    </Typography>
                    <Chip label="Published" size="small" color="success" variant="outlined" />
                  </Stack>
                  <Typography
                    component={RRLink}
                    to={`/kb/${article.id}`}
                    variant="subtitle2"
                    fontWeight={600}
                    sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                  >
                    {article.title}
                  </Typography>
                  {article.excerpt && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5 }}
                      dangerouslySetInnerHTML={{ __html: article.excerpt }}
                    />
                  )}
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={saving}
                  onClick={() => handleResolved(article)}
                >
                  My issue is resolved
                </Button>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Collapse>
    </Paper>
  );
}
