import { Navigate, Outlet, useLocation } from "react-router-dom";

// ── Map every role → its home dashboard ──────────────────────────────────────
const ROLE_HOME = {
  super_admin:       "/super-admin-dashboard",
  admin:             "/admin-dashboard",
  employee:          "/employee-dashboard",
  intern:            "/employee-dashboard",   // ← added
};

const ProtectedRoute = ({ allowedRoles }) => {
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const token      = localStorage.getItem("token");
  const location   = useLocation();

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!storedUser || !token) {
    return <Navigate to="/login" replace />;
  }

  // ── Normalise role ─────────────────────────────────────────────────────────
  const role = (
    storedUser.role       ||
    storedUser.user?.role ||
    ""
  ).toLowerCase();

  // ── Role check ─────────────────────────────────────────────────────────────
  const allowed = allowedRoles?.map(r => r.toLowerCase()) ?? [];

  if (allowedRoles && !allowed.includes(role)) {
    console.warn(
      `[ProtectedRoute] Access Denied. Path: "${location.pathname}", ` +
      `User Role: "${role}", Required Roles: ${JSON.stringify(allowedRoles)}. ` +
      `Redirecting to: ${ROLE_HOME[role] ?? "/employee-dashboard"}`
    );
    return <Navigate to={ROLE_HOME[role] ?? "/employee-dashboard"} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
