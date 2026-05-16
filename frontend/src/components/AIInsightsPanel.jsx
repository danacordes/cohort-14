import { useEffect, useRef, useState } from 'react';
import { useLazyQuery } from '@apollo/client/react';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AiSuggestionPanel from './AiSuggestionPanel.jsx';
import { SUGGEST_TICKET_CATEGORY, SUMMARIZE_TICKET } from '../graphql/ai.js';

export const SUGGEST_DEBOUNCE_MS = 600;
const MIN_TITLE_LEN = 3;

function isDeskRole(role) {
  return role === 'agent' || role === 'admin';
}

/**
 * Context-aware AI insights (WO #39). Fails silently — renders nothing on error or empty API result.
 *
 * @param {{
 *   mode: 'submit' | 'detail';
 *   role?: string | null;
 *   title?: string;
 *   description?: string;
 *   onAcceptCategory?: (categoryId: string) => void;
 *   ticketId?: string;
 *   suggestDebounceMs?: number;
 * }} props
 */
export default function AIInsightsPanel({
  mode,
  role,
  title = '',
  description = '',
  onAcceptCategory,
  ticketId,
  suggestDebounceMs = SUGGEST_DEBOUNCE_MS,
}) {
  if (!isDeskRole(role)) return null;

  if (mode === 'submit') {
    return (
      <SubmitCategoryInsights
        title={title}
        description={description}
        onAcceptCategory={onAcceptCategory}
        debounceMs={suggestDebounceMs}
      />
    );
  }

  if (mode === 'detail' && ticketId) {
    return <DetailSummarizeInsights ticketId={ticketId} />;
  }

  return null;
}

function SubmitCategoryInsights({ title, description, onAcceptCategory, debounceMs }) {
  const [suggestion, setSuggestion] = useState(null);
  const [dismissedId, setDismissedId] = useState(null);
  const timerRef = useRef(null);

  const [runSuggest] = useLazyQuery(SUGGEST_TICKET_CATEGORY, { fetchPolicy: 'network-only' });

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const t = (title ?? '').trim();
    const d = (description ?? '').trim();

    timerRef.current = setTimeout(() => {
      if (t.length < MIN_TITLE_LEN) {
        setSuggestion(null);
        return;
      }
      runSuggest({ variables: { title: t, description: d || '' } })
        .then((res) => {
          const s = res?.data?.suggestTicketCategory;
          setSuggestion(s?.categoryId ? s : null);
        })
        .catch(() => setSuggestion(null));
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [title, description, runSuggest, debounceMs]);

  if (!suggestion || suggestion.categoryId === dismissedId) return null;

  return (
    <AiSuggestionPanel
      title="AI category suggestion"
      featureLabel="AI-generated"
      confidence={suggestion.confidence}
    >
      <Typography variant="body2">
        Suggested category: <strong>{suggestion.categoryName}</strong>
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
        <Button
          size="small"
          variant="contained"
          onClick={() => {
            onAcceptCategory?.(suggestion.categoryId);
            setDismissedId(suggestion.categoryId);
          }}
        >
          Accept
        </Button>
        <Button size="small" variant="text" onClick={() => setDismissedId(suggestion.categoryId)}>
          Dismiss
        </Button>
      </Stack>
    </AiSuggestionPanel>
  );
}

function DetailSummarizeInsights({ ticketId }) {
  const [summary, setSummary] = useState(null);
  const [visible, setVisible] = useState(false);
  const [suppressed, setSuppressed] = useState(false);

  const [runSummarize] = useLazyQuery(SUMMARIZE_TICKET, { fetchPolicy: 'network-only' });

  if (suppressed) return null;

  async function handleSummarize() {
    setSummary(null);
    setVisible(false);
    try {
      const res = await runSummarize({ variables: { ticketId } });
      const text = (res?.data?.summarizeTicket ?? '').trim();
      if (text) {
        setSummary(text);
        setVisible(true);
      } else {
        setSuppressed(true);
      }
    } catch {
      setSuppressed(true);
    }
  }

  if (visible && summary) {
    return (
      <AiSuggestionPanel title="Thread summary" featureLabel="AI-generated">
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {summary}
        </Typography>
        <Button size="small" variant="text" sx={{ mt: 0.5 }} onClick={() => setVisible(false)}>
          Dismiss
        </Button>
      </AiSuggestionPanel>
    );
  }

  return (
    <AiSuggestionPanel title="AI assistance" featureLabel="Summarization">
      <Button size="small" variant="outlined" onClick={handleSummarize}>
        Summarize thread
      </Button>
    </AiSuggestionPanel>
  );
}
