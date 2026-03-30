import React from "react";
import { User, Bell, Shield, Smartphone, ChevronRight } from "lucide-react";

export default function Settings() {
  const sections = [
    { icon: <User size={20} />, title: "Personal Information", desc: "Update your name, contact details, and address" },
    { icon: <Bell size={20} />, title: "Notifications", desc: "Manage how you receive alerts and updates" },
    { icon: <Shield size={20} />, title: "Security", desc: "Change your password and manage two-factor authentication" },
    { icon: <Smartphone size={20} />, title: "Connected Devices", desc: "View and manage devices where you're logged in" },
  ];

  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto", fontFamily: "'Inter', sans-serif" }}>
      <header style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", color: "#1e293b", fontWeight: "700", marginBottom: "8px" }}>Settings</h1>
        <p style={{ color: "#64748b", fontSize: "16px" }}>Manage your account settings and preferences.</p>
      </header>

      <div style={{ display: "grid", gap: "16px" }}>
        {sections.map((section, idx) => (
          <div key={idx} style={{ 
            background: "#fff", 
            padding: "20px", 
            borderRadius: "12px", 
            border: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f8fafc"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#fff"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ 
                width: "40px", 
                height: "40px", 
                background: "#f1f5f9", 
                borderRadius: "8px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                color: "#475569"
              }}>
                {section.icon}
              </div>
              <div>
                <h3 style={{ fontSize: "16px", color: "#1e293b", fontWeight: "600", marginBottom: "2px" }}>{section.title}</h3>
                <p style={{ fontSize: "13px", color: "#64748b" }}>{section.desc}</p>
              </div>
            </div>
            <ChevronRight size={20} color="#94a3b8" />
          </div>
        ))}
      </div>

      <div style={{ marginTop: "48px", borderTop: "1px solid #e2e8f0", paddingTop: "32px" }}>
        <h4 style={{ fontSize: "14px", color: "#ef4444", fontWeight: "600", marginBottom: "8px" }}>Danger Zone</h4>
        <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px" }}>Once you delete your account, there is no going back. Please be certain.</p>
        <button style={{ 
          padding: "10px 20px", 
          borderRadius: "8px", 
          border: "1px solid #fecaca", 
          background: "#fff", 
          color: "#ef4444", 
          fontWeight: "600", 
          fontSize: "14px", 
          cursor: "pointer",
          transition: "all 0.2s"
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#fef2f2"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
        >
          Deactivate Account
        </button>
      </div>
    </div>
  );
}
