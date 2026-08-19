import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../utils/api";
import AdminDashboard from "../pages/AdminDashboard";
import SuperAdminDashboard from "../pages/SuperAdminDashboard";
import EmployeeDashboard from "../pages/EmployeeDashboard";

export default function DashboardSwitcher() {
  // Initialise from sessionStorage immediately — never block the UI on a network call
  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem("user") || localStorage.getItem("user_backup");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Only show loader when there is truly no cached user at all
  const [loading, setLoading] = useState(false);
  const [redirectToLogin, setRedirectToLogin] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    let token = sessionStorage.getItem("token");
    let stored = sessionStorage.getItem("user");

    // Self-heal: something external has been wiping sessionStorage on refresh
    // for this deployment. If sessionStorage is empty but we have a backup in
    // localStorage from the last successful login, restore it before giving up.
    if ((!token || !stored) && localStorage.getItem("token_backup")) {
      console.warn("DashboardSwitcher: sessionStorage was empty, restoring from localStorage backup");
      token = localStorage.getItem("token_backup");
      stored = localStorage.getItem("user_backup");
      if (token) sessionStorage.setItem("token", token);
      if (stored) sessionStorage.setItem("user", stored);
    }

    // Hard gate: no token means definitely not logged in
    if (!token || !stored) {
      setRedirectToLogin(true);
      return;
    }

    // Check token expiry before even hitting the network
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        console.warn("DashboardSwitcher: Token is expired, clearing and redirecting");
        sessionStorage.clear(); localStorage.removeItem("token_backup"); localStorage.removeItem("user_backup");
        setRedirectToLogin(true);
        return;
      }
    } catch {
      console.warn("DashboardSwitcher: Could not parse token, clearing and redirecting");
      sessionStorage.clear(); localStorage.removeItem("token_backup"); localStorage.removeItem("user_backup");
      setRedirectToLogin(true);
      return;
    }

    // Background refresh — does NOT block rendering or redirect on failure
    // Uses a 5s timeout so a dead backend doesn't hang forever
    const refreshUserInBackground = async () => {
      // Give the backend 5 seconds max — avoids hanging when it's restarting
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const [userRes, permRes] = await Promise.all([
          api.get("/auth/me", { signal: controller.signal }),
          api.get("/permissions/my", { signal: controller.signal }),
        ]);

        clearTimeout(timeoutId);
        if (!isMounted) return; 

        const latestUser = userRes.data;
        if (!latestUser || !latestUser.role) return; 

        let roleDefaults = [];
        try {
          const roleDefRes = await api.get(
            `/meta/role-defaults/${latestUser.role}?department=${latestUser.department || ""}`,
            { signal: controller.signal }
          );
          roleDefaults = roleDefRes.data || [];
        } catch (roleErr) {
          
          if (roleErr?.code === "ERR_CANCELED") return;
          console.warn("DashboardSwitcher: Could not fetch role-defaults, using empty array", roleErr?.message);
        }

        if (!isMounted) return;

        const latestUserWithData = {
          ...latestUser,
          permissions: permRes.data,
          roleDefaults,
        };

        sessionStorage.setItem("user", JSON.stringify(latestUserWithData));
        setUser(latestUserWithData);
      } catch (err) {
        clearTimeout(timeoutId);
        if (!isMounted) return; 
        if (err?.code === "ERR_CANCELED" || err?.name === "AbortError") return; 

        
        if (err.response?.status === 401) {
          console.error("DashboardSwitcher: 401 — token rejected by server, clearing and redirecting");
          sessionStorage.clear(); localStorage.removeItem("token_backup"); localStorage.removeItem("user_backup");
          setRedirectToLogin(true);
        } else {
          
          console.warn(
            "DashboardSwitcher: Background refresh failed (non-401), using cached user data. Error:",
            err?.message
          );
        }
      }
    };

    refreshUserInBackground();

    return () => {
      isMounted = false;
      controller.abort(); 
    };
  }, []);

  if (redirectToLogin) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "40px", height: "40px", border: "3px solid #e2e8f0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "#64748b", fontSize: "14px", fontWeight: "500" }}>Preparing your dashboard...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = (user?.role || "").toLowerCase().trim();
  const permissions = user?.permissions || [];

  if (role === "super_admin") {
    return <SuperAdminDashboard />;
  }

  const hasAdminRole = role === "admin" || role === "team_lead";
  const hasSpecialPermissions =
    Array.isArray(permissions) && permissions.some((p) => p.can_read || p.can_write);

  if (hasAdminRole || hasSpecialPermissions) {
    return <AdminDashboard roleDefaults={user?.roleDefaults || []} />;
  }

  return <EmployeeDashboard />;
}
