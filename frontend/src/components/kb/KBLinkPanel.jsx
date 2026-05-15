import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLazyQuery } from '@apollo/client/react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { KB_SEARCH } from '../../graphql/kb.js';

const INACTIVE_STATUSES = ['Retired', 'Archived', 'Expired'];

/**
 * Reusable panel for searching and linking KB articles to tickets or problem records.
 *
 * Props:
 *   linkedArticles: Array<{ id, number, title, status }>
 *   onLink:   (article) => void  — called when user attaches an article
 *   onUnlink: (articleId) => void — called when user removes a linked article
 *   readOnly: boolean (default false)
 */
export default function KBLinkPanel({ linkedArticles = [], onLink, onUnlink, readOnly = false }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);

  const [runSearch, { loading }] = useLazyQuery(KB_SEARCH, {
    onCompleted(data) {
      setResults(data.kbSearch.items);
      setSearched(true);
    },
    fetchPolicy: 'network-only',
  });

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    runSearch({
      variables: {
        query,
        filters: { status: 'Published' },
        page: { page: 1, pageSize: 10 },
      },
    });
  };

  const linkedIds = new Set(linkedArticles.map((a) => a.id));

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
        Linked KB Articles
      </Typography>

      {linkedArticles.length === 0 ? (
        <Typography variant="body2" color="text.secondary" mb={1}>
          No articles linked yet.
        </Typography>
      ) : (
        <List dense disablePadding sx={{ mb: 1 }}>
          {linkedArticles.map((article) => {
            const isInactive = INACTIVE_STATUSES.includes(article.status);
            return (
              <ListItem
                key={article.id}
                disableGutters
                secondaryAction={
                  !readOnly && (
                    <Button size="small" color="error" onClick={() => onUnlink?.(article.id)}>
                      Remove
                    </Button>
                  )
                }
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography
                        variant="body2"
                        sx={{ cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => navigate(`/kb/${article.id}`)}
                      >
                        {article.number} — {article.title}
                      </Typography>
                      {isInactive && (
                        <Tooltip title={`This article is ${article.status} and may be outdated.`}>
                          <Chip label={article.status} color="warning" size="small" />
                        </Tooltip>
                      )}
                    </Stack>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      )}

      {!readOnly && (
        <>
          <Divider sx={{ my: 1 }} />
          <Paper
            component="form"
            onSubmit={handleSearch}
            variant="outlined"
            sx={{ p: 1.5, mt: 1 }}
          >
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                fullWidth
                placeholder="Search KB articles to link…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">🔍</InputAdornment>,
                }}
              />
              <Button type="submit" variant="outlined" size="small" disabled={loading || !query.trim()}>
                {loading ? <CircularProgress size={16} /> : 'Search'}
              </Button>
            </Stack>

            {searched && results.length === 0 && (
              <Alert severity="info" sx={{ mt: 1 }}>No published articles match your query.</Alert>
            )}

            {results.length > 0 && (
              <List dense sx={{ mt: 1 }}>
                {results.map((article) => (
                  <ListItem
                    key={article.id}
                    disableGutters
                    secondaryAction={
                      linkedIds.has(article.id) ? (
                        <Chip label="Linked" size="small" color="success" />
                      ) : (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => {
                            onLink?.(article);
                            setResults((prev) =>
                              prev.filter((r) => r.id !== article.id)
                            );
                          }}
                        >
                          Attach
                        </Button>
                      )
                    }
                  >
                    <ListItemText
                      primary={
                        <Typography variant="body2">
                          {article.number} — {article.title}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {article.articleType} · {article.category?.name}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </>
      )}
    </Box>
  );
}
