import { Routes, Route } from 'react-router-dom';
import AuthGuard from './components/AuthGuard.jsx';
import GlobalErrorDisplay from './components/GlobalErrorDisplay.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NotFound from './pages/NotFound.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SsoCallbackPage from './pages/SsoCallbackPage.jsx';
import KBSearchPage from './pages/kb/KBSearchPage.jsx';
import KBArticlePage from './pages/kb/KBArticlePage.jsx';
import KBArticleEditorPage from './pages/kb/KBArticleEditorPage.jsx';
import KBReviewPage from './pages/kb/KBReviewPage.jsx';
import KBAdminDashboard from './pages/kb/KBAdminDashboard.jsx';
import DashboardPage from './pages/reporting/DashboardPage.jsx';
import ReportPage from './pages/reporting/ReportPage.jsx';
import TicketSubmitPage from './pages/tickets/TicketSubmitPage.jsx';
import MyTicketsPage from './pages/tickets/MyTicketsPage.jsx';
import TicketDetailPage from './pages/tickets/TicketDetailPage.jsx';

function App() {
  return (
    <>
      <GlobalErrorDisplay />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<SsoCallbackPage />} />

        {/* Protected routes — wrapped by AuthGuard */}
        <Route element={<AuthGuard />}>
          <Route
            path="/"
            element={
              <ErrorBoundary>
                <Dashboard />
              </ErrorBoundary>
            }
          />

          {/* Knowledge Base */}
          <Route
            path="/kb"
            element={
              <ErrorBoundary>
                <KBSearchPage />
              </ErrorBoundary>
            }
          />
          <Route
            path="/kb/new"
            element={
              <ErrorBoundary>
                <KBArticleEditorPage />
              </ErrorBoundary>
            }
          />
          <Route
            path="/kb/review"
            element={
              <ErrorBoundary>
                <KBReviewPage />
              </ErrorBoundary>
            }
          />
          <Route
            path="/kb/admin"
            element={
              <ErrorBoundary>
                <KBAdminDashboard />
              </ErrorBoundary>
            }
          />
          <Route
            path="/kb/:id"
            element={
              <ErrorBoundary>
                <KBArticlePage />
              </ErrorBoundary>
            }
          />
          <Route
            path="/kb/:id/edit"
            element={
              <ErrorBoundary>
                <KBArticleEditorPage />
              </ErrorBoundary>
            }
          />

          {/* Reporting & Analytics */}
          <Route
            path="/reporting"
            element={
              <ErrorBoundary>
                <DashboardPage />
              </ErrorBoundary>
            }
          />
          <Route
            path="/reporting/:reportType"
            element={
              <ErrorBoundary>
                <ReportPage />
              </ErrorBoundary>
            }
          />

          {/* Ticket submission & submitter portal */}
          <Route
            path="/tickets"
            element={
              <ErrorBoundary>
                <MyTicketsPage />
              </ErrorBoundary>
            }
          />
          <Route
            path="/tickets/submit"
            element={
              <ErrorBoundary>
                <TicketSubmitPage />
              </ErrorBoundary>
            }
          />
          <Route
            path="/tickets/:id"
            element={
              <ErrorBoundary>
                <TicketDetailPage />
              </ErrorBoundary>
            }
          />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default App;
