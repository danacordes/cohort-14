import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { buildSlaCaption } from '../slaDisplay.js';

const LABEL = {
  ON_TRACK: 'On track',
  AT_RISK: 'At risk',
  BREACHED: 'Breached',
  PAUSED: 'Paused',
  UNKNOWN: 'Unknown',
};

/** @param {{ dense?: boolean } & Record<string, unknown>} props */
export default function SLAIndicator({ dense = false, ...ticket }) {
  const status = ticket.slaStatus;
  const caption = buildSlaCaption(ticket);

  if (!status || status === 'UNKNOWN') {
    return (
      <Typography variant={dense ? 'caption' : 'body2'} color="text.secondary">
        —
      </Typography>
    );
  }

  const color =
    status === 'BREACHED'
      ? 'error'
      : status === 'AT_RISK'
        ? 'warning'
        : status === 'PAUSED'
          ? 'default'
          : 'success';

  const variant = status === 'BREACHED' ? 'filled' : 'outlined';

  const chip = (
    <Chip
      size="small"
      label={LABEL[status] ?? status}
      color={color}
      variant={variant}
      sx={{
        fontWeight: status === 'BREACHED' ? 700 : 500,
      }}
    />
  );

  const body = (
    <Stack spacing={0.25} alignItems="flex-start">
      {chip}
      {caption ? (
        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: dense ? 140 : 280 }}>
          {caption}
        </Typography>
      ) : null}
    </Stack>
  );

  if (!caption) return body;

  return (
    <Tooltip title={`SLA status: ${LABEL[status] ?? status}`}>
      <span>{body}</span>
    </Tooltip>
  );
}
