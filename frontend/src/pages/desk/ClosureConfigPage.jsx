import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  ADD_HOLIDAY,
  CLOSURE_CONFIG,
  HOLIDAYS,
  REMOVE_HOLIDAY,
  UPDATE_CLOSURE_CONFIG,
  UPDATE_CSAT_CONFIG,
} from '../../graphql/closure.js';
import { selectRole } from '../../store/authSlice.js';

export default function ClosureConfigPage() {
  const role = useSelector(selectRole);
  const [autoDaysInput, setAutoDaysInput] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayLabel, setHolidayLabel] = useState('');
  const [localError, setLocalError] = useState('');

  const { data: cfgData, refetch: refetchCfg } = useQuery(CLOSURE_CONFIG, {
    skip: role !== 'admin',
  });
  const { data: holidayData, refetch: refetchHolidays } = useQuery(HOLIDAYS, {
    skip: role !== 'admin',
  });

  const [updateClosure, { loading: savingClosure }] = useMutation(UPDATE_CLOSURE_CONFIG, {
    onCompleted: () => {
      setLocalError('');
      refetchCfg();
    },
    onError: (e) => setLocalError(e.message ?? 'Could not save auto-close settings.'),
  });

  const [updateCsat, { loading: savingCsat }] = useMutation(UPDATE_CSAT_CONFIG, {
    onCompleted: () => {
      setLocalError('');
      refetchCfg();
    },
    onError: (e) => setLocalError(e.message ?? 'Could not update CSAT setting.'),
  });

  const [addHolidayMut, { loading: adding }] = useMutation(ADD_HOLIDAY, {
    onCompleted: () => {
      setHolidayDate('');
      setHolidayLabel('');
      setLocalError('');
      refetchHolidays();
    },
    onError: (e) => setLocalError(e.message ?? 'Could not add holiday.'),
  });

  const [removeHolidayMut] = useMutation(REMOVE_HOLIDAY, {
    onCompleted: () => {
      refetchHolidays();
    },
    onError: (e) => setLocalError(e.message ?? 'Could not remove holiday.'),
  });

  const cfg = cfgData?.closureConfig;

  useEffect(() => {
    if (cfg?.autoCloseBusinessDays != null) {
      setAutoDaysInput(String(cfg.autoCloseBusinessDays));
    }
  }, [cfg?.autoCloseBusinessDays]);

  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const holidays = holidayData?.holidays ?? [];

  async function handleSaveAutoClose() {
    const n = parseInt(autoDaysInput, 10);
    if (!Number.isFinite(n) || n < 1) {
      setLocalError('Auto-close window must be at least 1 business day.');
      return;
    }
    await updateClosure({ variables: { autoCloseBusinessDays: n } });
  }

  async function handleAddHoliday(e) {
    e.preventDefault();
    if (!holidayDate || !holidayLabel.trim()) {
      setLocalError('Holiday date and label are required.');
      return;
    }
    await addHolidayMut({
      variables: { date: holidayDate, label: holidayLabel.trim() },
    });
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 880, mx: 'auto' }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Closure & CSAT settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configure resolved-ticket auto-close, satisfaction surveys, and business holidays.
      </Typography>

      {localError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLocalError('')}>
          {localError}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Auto-close resolved tickets
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Submitter confirmation window before tickets automatically close (business days).
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <TextField
            label="Business days"
            type="number"
            size="small"
            inputProps={{ min: 1 }}
            value={autoDaysInput}
            onChange={(e) => setAutoDaysInput(e.target.value)}
            sx={{ width: 160 }}
          />
          <Button variant="contained" onClick={handleSaveAutoClose} disabled={savingClosure}>
            Save
          </Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Customer satisfaction surveys
        </Typography>
        <FormControlLabel
          control={(
            <Switch
              checked={Boolean(cfg?.csatEnabled)}
              disabled={savingCsat || cfg == null}
              onChange={(_e, checked) => updateCsat({ variables: { enabled: checked } })}
            />
          )}
          label={cfg?.csatEnabled ? 'CSAT surveys enabled' : 'CSAT surveys disabled'}
        />
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Holidays
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Dates excluded when calculating auto-close deadlines (YYYY-MM-DD).
        </Typography>

        <Stack component="form" direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} onSubmit={handleAddHoliday}>
          <TextField
            label="Date"
            type="date"
            size="small"
            value={holidayDate}
            onChange={(e) => setHolidayDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: { xs: '100%', sm: 180 } }}
          />
          <TextField
            label="Label"
            size="small"
            value={holidayLabel}
            onChange={(e) => setHolidayLabel(e.target.value)}
            sx={{ flex: 1 }}
          />
          <Button type="submit" variant="contained" disabled={adding}>
            Add
          </Button>
        </Stack>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Label</TableCell>
              <TableCell align="right">Remove</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {holidays.map((h) => (
              <TableRow key={h.id}>
                <TableCell>{h.date}</TableCell>
                <TableCell>{h.label}</TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    color="error"
                    onClick={() => removeHolidayMut({ variables: { id: h.id } })}
                  >
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!holidays.length && (
              <TableRow>
                <TableCell colSpan={3}>
                  <Typography variant="body2" color="text.secondary">
                    No holidays configured.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
