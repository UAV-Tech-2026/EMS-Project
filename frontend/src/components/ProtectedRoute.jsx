// import { Navigate, Outlet } from "react-router-dom";

// const ProtectedRoute = ({ allowedRoles }) => {
//   const user = JSON.parse(localStorage.getItem("user"));

//   console.log("ProtectedRoute USER:", user);

//   if (!user) return <Navigate to="/login" replace />;

//   const role = user.role?.toLowerCase();

//   // ✅ Flexible role check
//   if (
//     allowedRoles &&
//     !allowedRoles.some(r => role.includes(r.toLowerCase()))
//   ) {
//     return <Navigate to="/" replace />;
//   }

//   return <Outlet context={{ user }} />;
// };

// export default ProtectedRoute;




import { Navigate, Outlet, useLocation } from "react-router-dom";

const ProtectedRoute = ({ allowedRoles }) => {
  const storedUser = JSON.parse(localStorage.getItem("user"));
  const token      = localStorage.getItem("token");

  // Not logged in
  if (!storedUser || !token) {
    return <Navigate to="/login" replace />;
  }

  // Support both { role: "admin" } and { user: { role: "admin" } }
  const role = (
    storedUser.role ||
    storedUser.user?.role ||
    ""
  ).toLowerCase();

  const location = useLocation();

  // Role not in allowed list
  if (allowedRoles && !allowedRoles.map(r => r.toLowerCase()).includes(role)) {
    console.warn(`[ProtectedRoute] Access Denied. Path: "${location.pathname}", User Role: "${role}", Required Roles: ${JSON.stringify(allowedRoles)}. Redirecting to: ${role}`);
    // Redirect to their own dashboard instead of login
    if (role === "super_admin") return <Navigate to="/super-admin-dashboard" replace />;
    if (role === "admin")       return <Navigate to="/admin-dashboard" replace />;
    return <Navigate to="/employee-dashboard" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
