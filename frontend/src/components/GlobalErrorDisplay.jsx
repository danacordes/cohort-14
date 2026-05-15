import { useSelector, useDispatch } from 'react-redux';
import { useState, useEffect } from 'react';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Box from '@mui/material/Box';
import {
  selectErrors,
  selectNetworkError,
  removeError,
  setNetworkError,
} from '../store/errorsSlice.js';

function GlobalErrorDisplay() {
  const dispatch = useDispatch();
  const networkError = useSelector(selectNetworkError);
  const errors = useSelector(selectErrors);

  const snackbarErrors = errors.filter(
    (e) => e.code !== 'FORBIDDEN' && e.code !== 'NOT_FOUND'
  );
  const alertErrors = errors.filter(
    (e) => e.code === 'FORBIDDEN' || e.code === 'NOT_FOUND'
  );

  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [currentSnackbar, setCurrentSnackbar] = useState(null);

  useEffect(() => {
    if (snackbarErrors.length > 0 && !openSnackbar) {
      setCurrentSnackbar(snackbarErrors[0]);
      setOpenSnackbar(true);
    }
  }, [snackbarErrors, openSnackbar]);

  const handleSnackbarClose = (_, reason) => {
    if (reason === 'clickaway') return;
    setOpenSnackbar(false);
    if (currentSnackbar) {
      dispatch(removeError(currentSnackbar.id));
    }
  };

  return (
    <>
      {/* Persistent network error banner */}
      {networkError && (
        <Alert
          severity="error"
          onClose={() => dispatch(setNetworkError(false))}
          sx={{ borderRadius: 0, position: 'sticky', top: 0, zIndex: 1300 }}
        >
          Unable to connect to server. Please check your connection.
        </Alert>
      )}

      {/* Inline alert errors (FORBIDDEN, NOT_FOUND) */}
      {alertErrors.length > 0 && (
        <Box sx={{ px: 2, pt: 1 }}>
          {alertErrors.map((e) => (
            <Alert
              key={e.id}
              severity={e.code === 'FORBIDDEN' ? 'warning' : 'info'}
              onClose={() => dispatch(removeError(e.id))}
              sx={{ mb: 1 }}
            >
              {e.message}
            </Alert>
          ))}
        </Box>
      )}

      {/* Snackbar for generic errors */}
      <Snackbar
        open={openSnackbar}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity="error"
          variant="filled"
          sx={{ width: '100%' }}
        >
          {currentSnackbar?.message ?? 'Something went wrong. Please try again.'}
        </Alert>
      </Snackbar>
    </>
  );
}

export default GlobalErrorDisplay;
