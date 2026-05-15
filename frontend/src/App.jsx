import { Routes, Route } from 'react-router-dom';
import AuthGuard from './components/AuthGuard.jsx';
import GlobalErrorDisplay from './components/GlobalErrorDisplay.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NotFound from './pages/NotFound.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SsoCallbackPage from './pages/SsoCallbackPage.jsx';

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
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default App;
