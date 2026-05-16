import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * Container for AI-generated suggestions (classification, routing, summaries).
 * When `children` or `onOverride` are provided, renders an actionable suggestion;
 * otherwise can show a short `caption` explaining how AI output will appear here.
 *
 * @param {{
 *   title?: string;
 *   featureLabel?: string;
 *   confidence?: number | null;
 *   caption?: string;
 *   children?: import('react').ReactNode;
 *   onOverride?: () => void;
 *   overrideLabel?: string;
 *   overrideDisabled?: boolean;
 * }} props
 */
export default function AiSuggestionPanel({
  title = 'AI assistance',
  featureLabel,
  confidence,
  caption,
  children,
  onOverride,
  overrideLabel = 'Override',
  overrideDisabled = false,
}) {
  const showOverride = typeof onOverride === 'function';
  const showConfidence = confidence != null && !Number.isNaN(Number(confidence));

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3, borderStyle: 'dashed' }}>
      <Typography variant="subtitle1" gutterBottom fontWeight={600}>
        {title}
      </Typography>
      {featureLabel ? (
        <Chip size="small" label={featureLabel} sx={{ mb: 1 }} variant="outlined" />
      ) : null}
      {children ? (
        <Stack spacing={1}>{children}</Stack>
      ) : caption ? (
        <Typography variant="body2" color="text.secondary">
          {caption}
        </Typography>
      ) : null}
      {showConfidence ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          Confidence: {Math.round(Number(confidence) * 100)}%
        </Typography>
      ) : null}
      {showOverride ? (
        <Button
          sx={{ mt: 1 }}
          size="small"
          variant="outlined"
          onClick={onOverride}
          disabled={overrideDisabled}
        >
          {overrideLabel}
        </Button>
      ) : null}
    </Paper>
  );
}
