import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { homePath } from "../lib/roles";
import Spinner from "./Spinner";

// Guards a route by login state, the forced-password-change flag, and role.
// Note: this is convenience and good UX only -- the server independently rejects
// any call the user is not allowed to make.
export default function ProtectedRoute({ roles, allowPasswordChange = false, children }) {
  const { user, restoring } = useAuth();
  const location = useLocation();

  // Still checking a stored token: don't decide yet, or we'd flash the login page.
  if (restoring) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Loading..." />
      </div>
    );
  }

  if (!user) {
    // Remember where they were headed so we can send them back after login.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Until the temporary password is changed, nothing else is reachable. The
  // change-password route itself sets allowPasswordChange so it can render
  // (otherwise it would redirect to itself forever).
  if (user.must_change_password && !allowPasswordChange) {
    return <Navigate to="/change-password" replace />;
  }

  // Wrong role for this page: send them to their own home rather than a 403 wall.
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homePath(user.role)} replace />;
  }

  return children;
}
