import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Box, CircularProgress, Typography } from '@mui/material';
import { ssoCallback, selectIsAuthenticated } from '../store/authSlice.js';

export default function SsoCallbackPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    // ssoCallback reads window.location.hash and updates Redux + localStorage synchronously
    dispatch(ssoCallback());
    setProcessed(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!processed) return;

    if (isAuthenticated) {
      navigate('/', { replace: true });
    } else {
      const missingToken = !window.location.hash.includes('token=');
      navigate(
        missingToken ? '/login?error=sso_failed' : '/login?error=invalid_token',
        { replace: true }
      );
    }
  }, [processed, isAuthenticated, navigate]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography variant="body2" color="text.secondary">
        Completing sign-in…
      </Typography>
    </Box>
  );
}
