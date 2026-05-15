import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  KB_ARTICLE,
  CREATE_KB_ARTICLE,
  UPDATE_KB_ARTICLE,
  SUBMIT_FOR_REVIEW,
} from '../../graphql/kb.js';
import {
  setEditorDraft,
  patchDraft,
  resetDraft,
  setDraftValidationErrors,
  setLoading,
  selectEditorDraft,
  selectKBLoading,
} from '../../store/kbSlice.js';
import { selectRole } from '../../store/authSlice.js';

const ARTICLE_TYPES = ['Solution', 'How-To Guide', 'Known Error', 'FAQ'];

function TagInput({ tags, onChange }) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  };

  const removeTag = (tag) => onChange(tags.filter((t) => t !== tag));

  return (
    <Box>
      <Stack direction="row" spacing={1} mb={1} flexWrap="wrap">
        {tags.map((tag) => (
          <Chip key={tag} label={tag} onDelete={() => removeTag(tag)} size="small" />
        ))}
      </Stack>
      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          placeholder="Add tag…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
        />
        <Button size="small" onClick={addTag} variant="outlined">Add</Button>
      </Stack>
    </Box>
  );
}

export default function KBArticleEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const draft = useSelector(selectEditorDraft);
  const isSaving = useSelector(selectKBLoading('save'));
  const role = useSelector(selectRole);

  const isEdit = Boolean(id);
  const [isDirty, setIsDirty] = useState(false);
  const [discardDialog, setDiscardDialog] = useState(false);
  const [pendingNav, setPendingNav] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Pre-populate from ticket context when promoted from ticket resolution
  useEffect(() => {
    const ctx = location.state?.ticketContext;
    if (ctx && !isEdit) {
      dispatch(
        setEditorDraft({
          title: ctx.title ?? '',
          body: ctx.resolutionSummary ?? '',
          articleType: 'Solution',
          categoryId: '',
          tags: [],
        })
      );
    } else if (!isEdit) {
      dispatch(resetDraft());
    }
  }, [isEdit, dispatch, location.state]);

  useQuery(KB_ARTICLE, {
    variables: { id },
    skip: !isEdit,
    onCompleted(data) {
      const a = data.kbArticle;
      dispatch(
        setEditorDraft({
          title: a.title,
          body: a.body,
          articleType: a.articleType,
          categoryId: a.category?.id ?? '',
          tags: a.tags ?? [],
          reviewDueAt: a.reviewDueAt ?? null,
          expiresAt: a.expiresAt ?? null,
        })
      );
    },
  });

  const [createArticle] = useMutation(CREATE_KB_ARTICLE);
  const [updateArticle] = useMutation(UPDATE_KB_ARTICLE);
  const [submitForReview] = useMutation(SUBMIT_FOR_REVIEW);

  const patch = (field, value) => {
    dispatch(patchDraft({ [field]: value }));
    setIsDirty(true);
  };

  const buildInput = () => ({
    title: draft.title,
    body: draft.body,
    articleType: draft.articleType || null,
    categoryId: draft.categoryId || null,
    tags: draft.tags,
    reviewDueAt: draft.reviewDueAt || null,
    expiresAt: draft.expiresAt || null,
  });

  const validatePublish = () => {
    const errs = {};
    if (!draft.title.trim()) errs.title = 'Title is required.';
    if (!draft.body.trim()) errs.body = 'Body is required.';
    if (!draft.articleType) errs.articleType = 'Article type is required.';
    if (!draft.categoryId) errs.categoryId = 'Category is required.';
    return errs;
  };

  const handleSaveDraft = async () => {
    dispatch(setLoading({ key: 'save', value: true }));
    try {
      if (isEdit) {
        await updateArticle({ variables: { id, input: buildInput() } });
      } else {
        const res = await createArticle({ variables: { input: buildInput() } });
        navigate(`/kb/${res.data.createKBArticle.id}/edit`, { replace: true });
      }
      setIsDirty(false);
      setSuccessMsg('Draft saved.');
    } catch (err) {
      const fieldErrors = {};
      err.graphQLErrors?.forEach(({ extensions }) => {
        if (extensions?.field) fieldErrors[extensions.field] = extensions.message;
      });
      if (Object.keys(fieldErrors).length) {
        dispatch(setDraftValidationErrors(fieldErrors));
      }
    } finally {
      dispatch(setLoading({ key: 'save', value: false }));
    }
  };

  const handleSubmitForReview = async () => {
    const errs = validatePublish();
    if (Object.keys(errs).length) {
      dispatch(setDraftValidationErrors(errs));
      return;
    }
    dispatch(setLoading({ key: 'save', value: true }));
    try {
      let articleId = id;
      if (!isEdit) {
        const res = await createArticle({ variables: { input: buildInput() } });
        articleId = res.data.createKBArticle.id;
      } else {
        await updateArticle({ variables: { id, input: buildInput() } });
      }
      await submitForReview({ variables: { id: articleId } });
      setIsDirty(false);
      navigate(`/kb/${articleId}`);
    } catch (err) {
      const fieldErrors = {};
      err.graphQLErrors?.forEach(({ extensions }) => {
        if (extensions?.field) fieldErrors[extensions.field] = extensions.message;
      });
      if (Object.keys(fieldErrors).length) {
        dispatch(setDraftValidationErrors(fieldErrors));
      }
    } finally {
      dispatch(setLoading({ key: 'save', value: false }));
    }
  };

  const handlePublish = async () => {
    const errs = validatePublish();
    if (Object.keys(errs).length) {
      dispatch(setDraftValidationErrors(errs));
      return;
    }
    dispatch(setLoading({ key: 'save', value: true }));
    try {
      const input = { ...buildInput(), status: 'Published' };
      let articleId = id;
      if (!isEdit) {
        const res = await createArticle({ variables: { input } });
        articleId = res.data.createKBArticle.id;
      } else {
        await updateArticle({ variables: { id, input } });
      }
      setIsDirty(false);
      navigate(`/kb/${articleId}`);
    } catch (err) {
      const fieldErrors = {};
      err.graphQLErrors?.forEach(({ extensions }) => {
        if (extensions?.field) fieldErrors[extensions.field] = extensions.message;
      });
      if (Object.keys(fieldErrors).length) {
        dispatch(setDraftValidationErrors(fieldErrors));
      }
    } finally {
      dispatch(setLoading({ key: 'save', value: false }));
    }
  };

  const requestNav = (dest) => {
    if (isDirty) {
      setPendingNav(dest);
      setDiscardDialog(true);
    } else {
      navigate(dest);
    }
  };

  return (
    <Box maxWidth={900} mx="auto" p={3}>
      <Button size="small" onClick={() => requestNav(isEdit ? `/kb/${id}` : '/kb')} sx={{ mb: 2 }}>
        ← {isEdit ? 'Back to Article' : 'Back to Search'}
      </Button>

      <Typography variant="h5" fontWeight={700} mb={3}>
        {isEdit ? 'Edit Article' : 'New Article'}
      </Typography>

      {successMsg && (
        <Alert severity="success" onClose={() => setSuccessMsg(null)} sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Stack spacing={3}>
          <TextField
            label="Title"
            fullWidth
            required
            value={draft.title}
            onChange={(e) => patch('title', e.target.value)}
            error={!!draft.validationErrors?.title}
            helperText={draft.validationErrors?.title}
          />

          <TextField
            label="Body"
            fullWidth
            required
            multiline
            minRows={10}
            value={draft.body}
            onChange={(e) => patch('body', e.target.value)}
            error={!!draft.validationErrors?.body}
            helperText={draft.validationErrors?.body}
          />

          <Stack direction="row" spacing={2}>
            <FormControl fullWidth error={!!draft.validationErrors?.articleType}>
              <InputLabel>Article Type *</InputLabel>
              <Select
                label="Article Type *"
                value={draft.articleType}
                onChange={(e) => patch('articleType', e.target.value)}
              >
                {ARTICLE_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
              {draft.validationErrors?.articleType && (
                <Typography variant="caption" color="error">
                  {draft.validationErrors.articleType}
                </Typography>
              )}
            </FormControl>

            <TextField
              label="Category ID"
              fullWidth
              required
              value={draft.categoryId}
              onChange={(e) => patch('categoryId', e.target.value)}
              error={!!draft.validationErrors?.categoryId}
              helperText={draft.validationErrors?.categoryId ?? 'Category selector pending API'}
            />
          </Stack>

          <Box>
            <Typography variant="subtitle2" gutterBottom>Tags</Typography>
            <TagInput tags={draft.tags} onChange={(tags) => patch('tags', tags)} />
          </Box>

          <Stack direction="row" spacing={2}>
            <TextField
              label="Review Due Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={draft.reviewDueAt?.slice(0, 10) ?? ''}
              onChange={(e) => patch('reviewDueAt', e.target.value || null)}
            />
            <TextField
              label="Expiry Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={draft.expiresAt?.slice(0, 10) ?? ''}
              onChange={(e) => patch('expiresAt', e.target.value || null)}
            />
          </Stack>
        </Stack>

        <Divider sx={{ my: 3 }} />

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button variant="outlined" onClick={handleSaveDraft} disabled={isSaving}>
            {isSaving ? <CircularProgress size={18} /> : 'Save as Draft'}
          </Button>

          {role === 'agent' && (
            <Button variant="contained" color="primary" onClick={handleSubmitForReview} disabled={isSaving}>
              Submit for Review
            </Button>
          )}

          {role === 'admin' && (
            <Button variant="contained" color="success" onClick={handlePublish} disabled={isSaving}>
              Publish
            </Button>
          )}
        </Stack>
      </Paper>

      <Dialog open={discardDialog} onClose={() => setDiscardDialog(false)}>
        <DialogTitle>Discard unsaved changes?</DialogTitle>
        <DialogContent>
          <Typography>You have unsaved changes. Leave without saving?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiscardDialog(false)}>Stay</Button>
          <Button
            color="error"
            onClick={() => {
              setDiscardDialog(false);
              navigate(pendingNav);
            }}
          >
            Discard
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
