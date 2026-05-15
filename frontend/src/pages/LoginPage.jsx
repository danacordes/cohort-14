import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import { loginSuccess } from '../store/authSlice.js';

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? 'http://localhost:4000';

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${AUTH_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Invalid email or password.');
        return;
      }

      const { token } = await res.json();
      dispatch(loginSuccess(token));
      navigate('/', { replace: true });
    } catch {
      setError('Unable to reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSsoLogin = () => {
    setSsoLoading(true);
    window.location.href = `${AUTH_URL}/auth/cognito/login`;
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Paper elevation={3} sx={{ p: 4, maxWidth: 420, width: '100%' }}>
        <Typography variant="h5" fontWeight={700} mb={0.5}>
          Sign in
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Cohort 14 Support Portal
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleLogin} noValidate>
          <TextField
            label="Email"
            type="email"
            fullWidth
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mb: 3 }}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading || !email || !password}
            sx={{ mb: 2, py: 1.25 }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : 'Sign in'}
          </Button>
        </Box>

        <Divider sx={{ my: 2 }}>
          <Typography variant="caption" color="text.secondary">
            OR
          </Typography>
        </Divider>

        <Button
          variant="outlined"
          fullWidth
          onClick={handleSsoLogin}
          disabled={ssoLoading}
          sx={{ py: 1.25 }}
        >
          {ssoLoading ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            'Sign in with SSO'
          )}
        </Button>
      </Paper>
    </Box>
  );
}
