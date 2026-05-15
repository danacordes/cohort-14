import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';

function NotFound() {
  const navigate = useNavigate();
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="60vh"
      gap={2}
      textAlign="center"
      px={3}
    >
      <Typography variant="h2" fontWeight={700} color="text.secondary">
        404
      </Typography>
      <Typography variant="h5" fontWeight={600}>
        Page not found
      </Typography>
      <Typography variant="body1" color="text.secondary">
        The page you are looking for does not exist.
      </Typography>
      <Button variant="contained" onClick={() => navigate('/')}>
        Go to Dashboard
      </Button>
    </Box>
  );
}

export default NotFound;
