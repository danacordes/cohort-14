import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useLazyQuery } from '@apollo/client/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { VIRTUAL_AGENT } from '../graphql/ai.js';

/**
 * @typedef {{ role: 'user' | 'assistant'; text: string; sources?: { id: string; number: string; title: string }[] }} ChatMessage
 */

/**
 * Conversational KB virtual agent (WO #39).
 */
export default function VirtualAgentView() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  /** @type {[ChatMessage[], Function]} */
  const [messages, setMessages] = useState([]);
  const [lastUserQuery, setLastUserQuery] = useState('');

  const [runVirtualAgent] = useLazyQuery(VIRTUAL_AGENT, { fetchPolicy: 'network-only' });

  async function handleSend(ev) {
    ev.preventDefault();
    const q = input.trim();
    if (!q) return;
    setLastUserQuery(q);
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    try {
      const res = await runVirtualAgent({ variables: { query: q } });
      const payload = res?.data?.virtualAgent;
      if (!payload?.answer) return;
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: payload.answer,
          sources: payload.sourceArticles ?? [],
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text:
            'The virtual agent is temporarily unavailable. Try KB search or submit a ticket for help from an agent.',
          sources: [],
        },
      ]);
    }
  }

  function handleEscalate() {
    const q = lastUserQuery.trim();
    navigate('/tickets/submit', {
      state: {
        prefillTitle: q.length > 80 ? `${q.slice(0, 77)}…` : q,
        prefillDescription: q,
      },
    });
  }

  const showEscalate =
    messages.length > 0 &&
    messages[messages.length - 1]?.role === 'assistant' &&
    (messages[messages.length - 1]?.sources?.length ?? 0) === 0;

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Responses are AI-generated and grounded in published knowledge base articles when a match is
        found. For direct browsing, use{' '}
        <Typography component={RouterLink} to="/kb" variant="body2" color="primary">
          KB search
        </Typography>
        .
      </Typography>

      <Paper
        variant="outlined"
        sx={{
          minHeight: 280,
          maxHeight: 420,
          overflow: 'auto',
          p: 2,
          bgcolor: 'grey.50',
        }}
      >
        {messages.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Ask a question in natural language, for example: &quot;How do I reset my VPN?&quot;
          </Typography>
        ) : (
          <Stack spacing={2}>
            {messages.map((m, idx) => (
              <Box
                key={`${m.role}-${idx}`}
                sx={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    bgcolor: m.role === 'user' ? 'primary.main' : 'background.paper',
                    color: m.role === 'user' ? 'primary.contrastText' : 'text.primary',
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {m.text}
                  </Typography>
                </Paper>
                {m.role === 'assistant' && m.sources && m.sources.length > 0 ? (
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Sources
                    </Typography>
                    {m.sources.map((a) => (
                      <Typography
                        key={a.id}
                        component={RouterLink}
                        to={`/kb/${a.id}`}
                        variant="body2"
                        color="primary"
                      >
                        {a.number}: {a.title}
                      </Typography>
                    ))}
                  </Stack>
                ) : null}
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      {showEscalate ? (
        <Button variant="outlined" color="secondary" onClick={handleEscalate}>
          Escalate to ticket
        </Button>
      ) : null}

      <Paper component="form" variant="outlined" onSubmit={handleSend} sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
          <TextField
            label="Your question"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            maxRows={4}
          />
          <Button type="submit" variant="contained" disabled={!input.trim()}>
            Send
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
