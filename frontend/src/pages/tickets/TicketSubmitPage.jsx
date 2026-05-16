import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useMutation, useQuery } from '@apollo/client/react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import AIInsightsPanel from '../../components/AIInsightsPanel.jsx';
import KBDeflectionPanel from '../../components/tickets/KBDeflectionPanel.jsx';
import { TICKET_CATEGORIES, CREATE_TICKET } from '../../graphql/tickets.js';
import { selectRole } from '../../store/authSlice.js';

/** Mirrors backend ALLOWED_MIME_TYPES in ticketAttachmentService.js */
const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf',
  'text/plain', 'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export default function TicketSubmitPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = useSelector(selectRole);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [files, setFiles] = useState([]);
  const [attachmentError, setAttachmentError] = useState('');
  const [deflectionCollapsed, setDeflectionCollapsed] = useState(false);

  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [confirmation, setConfirmation] = useState(null);

  const { data: catData } = useQuery(TICKET_CATEGORIES);
  const categories = catData?.ticketCategories?.filter((c) => c.isActive) ?? [];

  useEffect(() => {
    const s = location.state;
    if (!s) return;
    if (s.prefillTitle) setTitle(String(s.prefillTitle));
    if (s.prefillDescription) setDescription(String(s.prefillDescription));
  }, [location.state]);

  const [createTicket, { loading }] = useMutation(CREATE_TICKET, {
    onCompleted(res) {
      const t = res.createTicket;
      setConfirmation({ id: t.id, publicNumber: t.publicNumber, title: t.title });
      setSubmitError('');
    },
    onError(err) {
      setSubmitError(err.message || 'Submission failed.');
    },
  });

  function validateForm() {
    const next = {};
    if (!title.trim()) next.title = 'Title is required';
    if (!description.trim()) next.description = 'Description is required';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function onFileChange(ev) {
    setAttachmentError('');
    const picked = [...(ev.target.files ?? [])];
    const nextFiles = [...files];

    for (const f of picked) {
      if (!ALLOWED_MIME.has(f.type)) {
        setAttachmentError(`${f.name} has a file type that is not allowed.`);
        return;
      }
      if (f.size > MAX_FILE_BYTES) {
        setAttachmentError(`${f.name} exceeds the 10 MB limit.`);
        return;
      }
      nextFiles.push(f);
    }
    setFiles(nextFiles);
    ev.target.value = '';
  }

  function removeAttachment(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validateForm()) return;

    const attachments =
      files.length > 0
        ? files.map((f) => ({
            filename: f.name,
            mimeType: f.type || 'application/octet-stream',
            sizeBytes: f.size,
            storageKey: `local/${crypto.randomUUID()}`,
          }))
        : undefined;

    await createTicket({
      variables: {
        input: {
          title: title.trim(),
          description: description.trim(),
          priority: 'MEDIUM',
          categoryId: categoryId || undefined,
          attachments,
        },
      },
    });
  }

  function handleDeflectionResolved() {
    navigate('/tickets', { replace: false, state: { deflectionRecorded: true } });
  }

  if (confirmation) {
    return (
      <Box sx={{ p: 4, maxWidth: 560 }}>
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Ticket received
          </Typography>
          <Typography variant="body1" gutterBottom>
            Your ticket{' '}
            <Typography component="span" fontWeight={600}>
              #{confirmation.publicNumber}
            </Typography>{' '}
            has been created. Confirmation may also arrive by email depending on workspace settings.
          </Typography>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Button variant="contained" component={RouterLink} to={`/tickets/${confirmation.id}`}>
              View ticket status
            </Button>
            <Button variant="outlined" component={RouterLink} to="/tickets">
              Back to my tickets
            </Button>
            <Button variant="text" component={RouterLink} to="/tickets/submit">
              Submit another ticket
            </Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, maxWidth: 960 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Submit a ticket
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Describe your issue below. Required fields must be filled before you can submit.
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'flex-start',
          gap: 3,
        }}
      >
        <Paper component="form" noValidate variant="outlined" onSubmit={handleSubmit} sx={{ p: 3, flex: 1 }}>
          <Stack spacing={2}>
            <TextField
              label="Title"
              name="ticket-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setFieldErrors((p) => ({ ...p, title: '' }));
              }}
              fullWidth
              error={Boolean(fieldErrors.title)}
              helperText={fieldErrors.title}
            />

            <TextField
              label="Description"
              name="ticket-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setFieldErrors((p) => ({ ...p, description: '' }));
              }}
              fullWidth
              multiline
              minRows={5}
              error={Boolean(fieldErrors.description)}
              helperText={fieldErrors.description}
            />

            <AIInsightsPanel
              mode="submit"
              role={role}
              title={title}
              description={description}
              onAcceptCategory={setCategoryId}
            />

            <FormControl fullWidth>
              <InputLabel id="category-label">Category (optional)</InputLabel>
              <Select
                labelId="category-label"
                label="Category (optional)"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Attachments (optional)
              </Typography>
              <Button variant="outlined" component="label" sx={{ mr: 1 }}>
                Choose files
                <input
                  type="file"
                  hidden
                  multiple
                  accept={[...ALLOWED_MIME].join(',')}
                  onChange={onFileChange}
                />
              </Button>
              {attachmentError && (
                <Typography variant="caption" color="error" display="block">
                  {attachmentError}
                </Typography>
              )}
              {files.length > 0 && (
                <Stack sx={{ mt: 1 }}>
                  {files.map((f, idx) => (
                    <Typography key={`${f.name}-${idx}`} variant="body2">
                      {f.name} ({Math.round((f.size / 1024) * 10) / 10} KB)
                      <Button size="small" onClick={() => removeAttachment(idx)}>
                        Remove
                      </Button>
                    </Typography>
                  ))}
                </Stack>
              )}
            </Box>

            {submitError && <Alert severity="error">{submitError}</Alert>}

            <Button type="submit" variant="contained" disabled={loading}>
              Submit ticket
            </Button>
          </Stack>
        </Paper>

        <Box sx={{ width: '100%', maxWidth: { md: 400 } }}>
          <KBDeflectionPanel
            title={title}
            description={description}
            collapsed={deflectionCollapsed}
            onCollapse={() => setDeflectionCollapsed((c) => !c)}
            onResolved={handleDeflectionResolved}
          />
        </Box>
      </Box>
    </Box>
  );
}
