import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation } from '@apollo/client/react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { SUBMIT_CSAT_RESPONSE } from '../../graphql/tickets.js';

const RATINGS = [1, 2, 3, 4, 5];

export default function CSATSurveyPage() {
  const [params] = useSearchParams();
  const token = params.get('token')?.trim() ?? '';

  const [rating, setRating] = useState('');
  const [comment, setComment] = useState('');
  const [localError, setLocalError] = useState('');
  const [done, setDone] = useState(false);

  const [submitCsat, { loading }] = useMutation(SUBMIT_CSAT_RESPONSE, {
    onCompleted: () => {
      setLocalError('');
      setDone(true);
    },
    onError: (e) => {
      setLocalError(e.message ?? 'Could not submit survey.');
    },
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalError('');
    if (!token) {
      setLocalError('This survey link is missing a token.');
      return;
    }
    const r = parseInt(rating, 10);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      setLocalError('Please choose a rating from 1 to 5.');
      return;
    }
    await submitCsat({
      variables: {
        token,
        rating: r,
        comment: comment.trim() || undefined,
      },
    });
  }

  if (!token) {
    return (
      <Box sx={{ p: 4, maxWidth: 520, mx: 'auto', mt: 4 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Satisfaction survey
        </Typography>
        <Alert severity="warning">
          This page needs a valid survey link. Open the URL from your ticket closure email.
        </Alert>
      </Box>
    );
  }

  if (done) {
    return (
      <Box sx={{ p: 4, maxWidth: 520, mx: 'auto', mt: 4 }}>
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={700} gutterBottom color="success.main">
            Thank you
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Your feedback has been recorded.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, maxWidth: 520, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        How did we do?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Rate your recent support experience (1 = poor, 5 = excellent).
      </Typography>

      {localError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLocalError('')}>
          {localError}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 3 }} component="form" onSubmit={handleSubmit}>
        <FormControl component="fieldset" sx={{ mb: 2 }}>
          <FormLabel component="legend">Rating</FormLabel>
          <RadioGroup
            row
            name="rating"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          >
            {RATINGS.map((n) => (
              <FormControlLabel key={n} value={String(n)} control={<Radio />} label={String(n)} />
            ))}
          </RadioGroup>
        </FormControl>

        <TextField
          label="Comments (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          fullWidth
          multiline
          minRows={3}
          sx={{ mb: 2 }}
        />

        <Button type="submit" variant="contained" disabled={loading}>
          {loading ? 'Submitting…' : 'Submit feedback'}
        </Button>
      </Paper>
    </Box>
  );
}
