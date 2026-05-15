import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  KB_PENDING_REVIEW,
  APPROVE_KB_ARTICLE,
  REJECT_KB_ARTICLE,
} from '../../graphql/kb.js';
import {
  setPendingReview,
  setLoading,
  selectPendingReview,
  selectPendingReviewTotal,
  selectKBLoading,
} from '../../store/kbSlice.js';

export default function KBReviewPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const articles = useSelector(selectPendingReview);
  const total = useSelector(selectPendingReviewTotal);
  const isActionLoading = useSelector(selectKBLoading('action'));

  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectComments, setRejectComments] = useState('');
  const [feedback, setFeedback] = useState(null);

  const { loading, refetch } = useQuery(KB_PENDING_REVIEW, {
    variables: { page: { page: 1, pageSize: 50 } },
    onCompleted(data) {
      dispatch(setPendingReview(data.kbSearch));
    },
    fetchPolicy: 'network-only',
  });

  const [approveArticle] = useMutation(APPROVE_KB_ARTICLE);
  const [rejectArticle] = useMutation(REJECT_KB_ARTICLE);

  const handleApprove = async (id) => {
    dispatch(setLoading({ key: 'action', value: true }));
    try {
      await approveArticle({ variables: { id } });
      setFeedback({ type: 'success', message: 'Article approved and published.' });
      refetch();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      dispatch(setLoading({ key: 'action', value: false }));
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectComments.trim()) return;
    dispatch(setLoading({ key: 'action', value: true }));
    try {
      await rejectArticle({ variables: { id: rejectTarget.id, comments: rejectComments } });
      setFeedback({ type: 'info', message: 'Article returned to draft with reviewer comments.' });
      setRejectTarget(null);
      setRejectComments('');
      refetch();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      dispatch(setLoading({ key: 'action', value: false }));
    }
  };

  return (
    <Box maxWidth={1000} mx="auto" p={3}>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Pending Review
      </Typography>

      {feedback && (
        <Alert
          severity={feedback.type}
          onClose={() => setFeedback(null)}
          sx={{ mb: 2 }}
        >
          {feedback.message}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" mt={6}>
          <CircularProgress />
        </Box>
      ) : articles.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No articles pending review.</Typography>
        </Paper>
      ) : (
        <Paper variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Author</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {articles.map((article) => (
                <TableRow key={article.id} hover>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {article.number}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => navigate(`/kb/${article.id}`)}
                    >
                      {article.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {article.articleType && (
                      <Chip label={article.articleType} size="small" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{article.author?.email ?? '—'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {new Date(article.updatedAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        onClick={() => handleApprove(article.id)}
                        disabled={isActionLoading}
                      >
                        Approve
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => {
                          setRejectTarget(article);
                          setRejectComments('');
                        }}
                        disabled={isActionLoading}
                      >
                        Reject
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Box p={1.5}>
            <Typography variant="caption" color="text.secondary">
              {total} article{total !== 1 ? 's' : ''} pending review
            </Typography>
          </Box>
        </Paper>
      )}

      <Dialog open={!!rejectTarget} onClose={() => setRejectTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>Reject Article</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>
            Returning <strong>{rejectTarget?.title}</strong> to draft. Please provide comments for
            the author.
          </Typography>
          <TextField
            label="Comments"
            fullWidth
            multiline
            minRows={3}
            required
            value={rejectComments}
            onChange={(e) => setRejectComments(e.target.value)}
            error={!rejectComments.trim()}
            helperText={!rejectComments.trim() ? 'Comments are required.' : ''}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRejectConfirm}
            disabled={!rejectComments.trim() || isActionLoading}
          >
            {isActionLoading ? <CircularProgress size={16} /> : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
