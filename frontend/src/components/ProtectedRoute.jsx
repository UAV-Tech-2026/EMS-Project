import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function ProtectedRoute({ allowedRoles }) {
  const location = useLocation();

  const token = localStorage.getItem("token");
  const userRaw = localStorage.getItem("user");

 
  if (!token || !userRaw) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location, reason: "unauthenticated" }}
      />
    );
  }


  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      // Token expired — clear and redirect
      localStorage.clear();
      return (
        <Navigate
          to="/login"
          replace
          state={{ from: location, reason: "expired" }}
        />
      );
    }
  } catch {
  
    localStorage.clear();
    return <Navigate to="/login" replace state={{ reason: "invalid_token" }} />;
  }

  
  let user;
  try {
    user = JSON.parse(userRaw);
  } catch {
    localStorage.clear();
    return <Navigate to="/login" replace />;
  }

  
  if (allowedRoles && allowedRoles.length > 0) {
    const role = user?.role?.toLowerCase() || "";
    const allowed = allowedRoles.some(r => {
      
      if (r === "admin") return role.includes("admin");
      return role === r.toLowerCase();
    });

    if (!allowed) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <Outlet />;
}
