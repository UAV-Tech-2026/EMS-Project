import React, { useState, useEffect } from "react";
import { Settings, Lock } from "lucide-react";
import AdminPermissions from "../components/AdminPermissions.jsx";

export default function ControlPanel() {
  const [user, setUser] = useState(() =>
    JSON.parse(sessionStorage.getItem("user") || "{}")
  );

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const latest = JSON.parse(sessionStorage.getItem("user") || "{}");
        const hasPerms = Array.isArray(latest.permissions) && latest.permissions.length > 0;
        const currentHasPerms = Array.isArray(user.permissions) && user.permissions.length > 0;
        
        if (
          latest.role !== user.role ||
          hasPerms !== currentHasPerms ||
          JSON.stringify(latest.permissions) !== JSON.stringify(user.permissions)
        ) {
          setUser(latest);
        }
      } catch {
        
      }
    }, 300);

    const timeout = setTimeout(() => clearInterval(interval), 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [user]);

  const isSuperAdmin =
    user.role && 
    typeof user.role === "string" && 
    user.role.toLowerCase().replace(/[^a-z]/g, '') === "superadmin";

  if (!isSuperAdmin) {
    return (
      <div style={{ padding: "20px" }}>
        <h2>Access Denied</h2>
        <p>You do not have permission to view the Control Panel.</p>
      </div>
    );
  }

  return (
    <div className="cp-hub-wrapper">
      <div className="cp-hub-header-row">
        <div className="cp-hub-icon-box"><Settings size={20} color="#6366f1" /></div>
        <div>
          <h1 className="cp-hub-title">Control Panel</h1>
          <p className="cp-hub-subtitle">Central management hub for all administrative operations</p>
        </div>
      </div>

      <div className="cp-perms-box">
        <AdminPermissions excludeFeatures={["control_panel"]} />
      </div>

      <style>{cpStyles}</style>
    </div>
  );
}

const cpStyles = `
  .cp-hub-wrapper { padding: 24px; animation: cpFadeIn 0.4s ease-out; color: #1e293b; }
  .cp-hub-header-row { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
  .cp-hub-icon-box { width: 42px; height: 42px; background: #eef2ff; border-radius: 11px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .cp-hub-title { font-size: 20px; font-weight: 800; margin: 0; color: #0f172a; letter-spacing: -0.01em; }
  .cp-hub-subtitle { font-size: 13px; color: #64748b; margin: 3px 0 0; }
  .cp-perms-box { background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 24px; }
  @keyframes cpFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;
