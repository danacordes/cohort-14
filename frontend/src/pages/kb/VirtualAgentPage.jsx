import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import VirtualAgentView from '../../components/VirtualAgentView.jsx';

export default function VirtualAgentPage() {
  return (
    <Box sx={{ p: 4, maxWidth: 800 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Virtual agent
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Get answers from published knowledge base content. If nothing matches, you can open a
        ticket with your question pre-filled.
      </Typography>
      <VirtualAgentView />
    </Box>
  );
}
