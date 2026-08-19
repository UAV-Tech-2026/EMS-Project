import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

export default function ProtectedRoute({ allowedRoles }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    
    setIsReady(true);

    const handlePageShow = (e) => {
      if (!e.persisted) return;
      revalidate();
    };

    // const handleVisibilityChange = () => {
    //   if (document.visibilityState === "visible") {
    //     revalidate();
    //   }
    // };

    const revalidate = () => {
      const token = sessionStorage.getItem("token");
      const userRaw = sessionStorage.getItem("user");
      if (!token || !userRaw) {
        navigate("/login", { replace: true, state: { reason: "unauthenticated" } });
        return;
      }
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
          sessionStorage.clear();
          navigate("/login", { replace: true, state: { reason: "expired" } });
        }
      } catch {
        sessionStorage.clear();
        navigate("/login", { replace: true, state: { reason: "invalid_token" } });
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    // document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      if (typeof handleVisibilityChange === "function") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [navigate]);

  
  if (!isReady) return null;

  const token = sessionStorage.getItem("token");
  const userRaw = sessionStorage.getItem("user");

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
      sessionStorage.clear();
      return (
        <Navigate
          to="/login"
          replace
          state={{ from: location, reason: "expired" }}
        />
      );
    }
  } catch {
    sessionStorage.clear();
    return <Navigate to="/login" replace state={{ reason: "invalid_token" }} />;
  }

  let user;
  try {
    user = JSON.parse(userRaw);
  } catch {
    sessionStorage.clear();
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const role = user?.role?.toLowerCase() || "";
    const allowed = allowedRoles.some((r) => {
      if (r === "admin") return role.includes("admin");
      return role === r.toLowerCase();
    });
    if (!allowed) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <Outlet />;
}
