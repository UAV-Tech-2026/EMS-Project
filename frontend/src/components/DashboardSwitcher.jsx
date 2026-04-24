import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../utils/api";
import AdminDashboard from "../pages/AdminDashboard";
import SuperAdminDashboard from "../pages/SuperAdminDashboard";
import EmployeeDashboard from "../pages/EmployeeDashboard";

export default function DashboardSwitcher() {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(!user); // Only show loading if we don't even have cached data
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchLatestUser = async () => {
      try {
        const stored = localStorage.getItem("user");
        if (!stored) {
          setError(true);
          return;
        }

        // Fetch latest role and permissions from server
        const [userRes, permRes] = await Promise.all([
          api.get("/auth/me"),
          api.get("/permissions/my")
        ]);

        const latestUser = {
          ...userRes.data,
          permissions: permRes.data
        };

        console.log("DASHBOARD SWITCHER - LIVE USER DATA FETCHED:", latestUser);

        // Update localStorage so other components stay in sync
        localStorage.setItem("user", JSON.stringify(latestUser));
        setUser(latestUser);
      } catch (err) {
        console.error("DashboardSwitcher fetch error:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchLatestUser();
  }, []);

  if (error && !localStorage.getItem("token")) return <Navigate to="/login" replace />;


  const role = (user?.role || "").toLowerCase().trim();
  const permissions = user?.permissions || [];

  // 1. Super Admin always gets the Super Admin Dashboard
  if (role === "super_admin") {
    return <SuperAdminDashboard />;
  }

  // 2. DYNAMIC: If role contains "admin" OR they have any specific feature permissions, 
  // show the Admin Dashboard (which gates individual features by permission).
  const hasAdminRole = role.includes("admin") || role === "team_lead";
  const hasSpecialPermissions = Array.isArray(permissions) && permissions.some(p => p.can_read || p.can_write);

  if (hasAdminRole || hasSpecialPermissions) {
    return <AdminDashboard />;
  }

  // If we are still loading the LATEST permissions/role from server, 
  // and we haven't identified as an admin yet, keep showing the loader
  // to avoid flashing the Employee Dashboard.
  if (loading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="stdc-loading-spinner" style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
        <p style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>Preparing your dashboard...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // 3. Fallback to standard Employee Dashboard
  return <EmployeeDashboard />;
}
