import React from "react";
import { Building2 } from "lucide-react";
import "../styles/SuperAdminDashboard.css"; // Reuse existing styles or create new ones

export default function Departments() {
  return (
    <div style={{ padding: "24px", background: "#fff", borderRadius: "12px", minHeight: "400px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <div style={{ background: "#eef2ff", padding: "10px", borderRadius: "8px", color: "#4f46e5" }}>
          <Building2 size={24} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", color: "#1e293b" }}>Departments</h2>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "14px" }}>Manage company departments</p>
        </div>
      </div>
      
      <div style={{ padding: "40px", textAlign: "center", border: "1px dashed #cbd5e1", borderRadius: "12px" }}>
        <p style={{ color: "#64748b" }}>Department management feature is coming soon.</p>
        <button style={{ 
          marginTop: "16px", 
          padding: "8px 16px", 
          background: "#4f46e5", 
          color: "#fff", 
          border: "none", 
          borderRadius: "6px", 
          cursor: "pointer" 
        }}>
          + Create Department
        </button>
      </div>
    </div>
  );
}
