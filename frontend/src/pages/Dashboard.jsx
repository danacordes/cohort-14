import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { selectRole } from '../store/authSlice.js';

function NavCard({ label, description, onClick }) {
  return (
    <Button
      variant="outlined"
      onClick={onClick}
      sx={{
        textAlign: 'left',
        p: 2,
        flexDirection: 'column',
        alignItems: 'flex-start',
        minWidth: 220,
      }}
    >
      <Typography variant="subtitle1" fontWeight={600}>{label}</Typography>
      <Typography variant="caption" color="text.secondary">{description}</Typography>
    </Button>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const role = useSelector(selectRole);

  return (
    <Box p={4} maxWidth={900}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Welcome. Use the shortcuts below to navigate the portal.
      </Typography>

      <Divider sx={{ mb: 3 }} />

      <Typography variant="h6" fontWeight={600} mb={2}>Tickets</Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap" mb={4}>
        <NavCard
          label="Submit a ticket"
          description="Report an issue or request help"
          onClick={() => navigate('/tickets/submit')}
        />
        <NavCard
          label="My tickets"
          description={
            role === 'user'
              ? 'Tickets you submitted'
              : 'Tickets assigned to you'
          }
          onClick={() => navigate('/tickets')}
        />
        {(role === 'agent' || role === 'admin') && (
          <NavCard
            label="Service desk queue"
            description="Unassigned pool, filters, assignment"
            onClick={() => navigate('/desk/queue')}
          />
        )}
        {(role === 'agent' || role === 'admin') && (
          <NavCard
            label="Closed ticket archive"
            description="Search resolved history (read-only)"
            onClick={() => navigate('/desk/archive')}
          />
        )}
        {role === 'admin' && (
          <NavCard
            label="Closure & CSAT settings"
            description="Auto-close window, surveys, holidays"
            onClick={() => navigate('/desk/closure')}
          />
        )}
        {role === 'admin' && (
          <NavCard
            label="SLA settings"
            description="Targets and escalation thresholds"
            onClick={() => navigate('/desk/sla')}
          />
        )}
      </Stack>

      <Divider sx={{ mb: 3 }} />

      <Typography variant="h6" fontWeight={600} mb={2}>Knowledge Base</Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap" mb={4}>
        <NavCard
          label="Search KB"
          description="Find articles and solutions"
          onClick={() => navigate('/kb')}
        />
        {(role === 'agent' || role === 'admin') && (
          <NavCard
            label="New Article"
            description="Author a KB article"
            onClick={() => navigate('/kb/new')}
          />
        )}
        {(role === 'agent' || role === 'admin') && (
          <NavCard
            label="Pending Review"
            description="Articles awaiting approval"
            onClick={() => navigate('/kb/review')}
          />
        )}
        {role === 'admin' && (
          <NavCard
            label="KB Admin"
            description="Usage metrics and coverage gaps"
            onClick={() => navigate('/kb/admin')}
          />
        )}
      </Stack>

      <Divider sx={{ mb: 3 }} />

      <Typography variant="h6" fontWeight={600} mb={2}>Reports</Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap" mb={4}>
        <NavCard
          label="Dashboard"
          description="Live operational metrics"
          onClick={() => navigate('/reporting')}
        />
        <NavCard
          label="Ticket Volume"
          description="Submission and closure trends"
          onClick={() => navigate('/reporting/ticket-volume')}
        />
        <NavCard
          label="SLA Performance"
          description="Compliance rates and breaches"
          onClick={() => navigate('/reporting/sla-performance')}
        />
        <NavCard
          label="Quality & Satisfaction"
          description="FCR, reopen rate, CSAT"
          onClick={() => navigate('/reporting/quality')}
        />
        {role === 'admin' && (
          <NavCard
            label="Agent Performance"
            description="Per-agent metrics (admin)"
            onClick={() => navigate('/reporting/agent-performance')}
          />
        )}
        {role === 'admin' && (
          <NavCard
            label="KB Usage"
            description="Article views and deflections (admin)"
            onClick={() => navigate('/reporting/kb-usage')}
          />
        )}
      </Stack>
    </Box>
  );
}

export default Dashboard;
