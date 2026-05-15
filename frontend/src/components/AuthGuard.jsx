import { Outlet } from 'react-router-dom';

/**
 * AuthGuard — stub implementation.
 * Full implementation (token validation, redirect to /login) is owned by WO #22 (Build Authentication UI).
 * Currently renders protected routes unconditionally.
 */
function AuthGuard() {
  return <Outlet />;
}

export default AuthGuard;
