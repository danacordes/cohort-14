import { Component } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Unhandled render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="60vh"
          gap={2}
          px={3}
          textAlign="center"
        >
          <Typography variant="h5" fontWeight={600} color="error.main">
            Something went wrong
          </Typography>
          <Typography variant="body1" color="text.secondary" maxWidth={400}>
            An unexpected error occurred. Please reload the page. If the problem persists, contact support.
          </Typography>
          <Button
            variant="contained"
            color="error"
            onClick={() => window.location.reload()}
            sx={{ mt: 1 }}
          >
            Reload page
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
