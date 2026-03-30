import React, { useState, useEffect } from "react";
import { User, Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { api } from "../utils/api";
import { useNavigate } from "react-router-dom";

// ── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  const isOk = toast.type === "success";
  return (
    <div style={{
      position: "fixed", top: "20px", right: "20px", zIndex: 9999,
      background: isOk ? "#dcfce7" : "#fee2e2",
      color: isOk ? "#166534" : "#991b1b",
      border: `1px solid ${isOk ? "#bbf7d0" : "#fecaca"}`,
      borderRadius: "10px", padding: "12px 20px",
      display: "flex", alignItems: "center", gap: "10px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: "14px", fontWeight: 500,
      minWidth: "260px"
    }}>
      {isOk ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
      {toast.msg}
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Card({ title, icon, children }) {
  return (
    <div style={{
      background: "#fff", borderRadius: "14px",
      border: "1px solid #e2e8f0", marginBottom: "24px",
      overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)"
    }}>
      <div style={{
        padding: "18px 24px", borderBottom: "1px solid #f1f5f9",
        display: "flex", alignItems: "center", gap: "10px"
      }}>
        <div style={{
          width: "36px", height: "36px", background: "#eff6ff",
          borderRadius: "8px", display: "flex", alignItems: "center",
          justifyContent: "center", color: "#3b82f6"
        }}>{icon}</div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b" }}>{title}</h2>
      </div>
      <div style={{ padding: "24px" }}>{children}</div>
    </div>
  );
}

// ── Input field ────────────────────────────────────────────────────────────────
function Field({ label, value, onChange, type = "text", placeholder, disabled, extra }) {
  return (
    <div style={{ marginBottom: "18px" }}>
      <label style={{
        display: "block", fontSize: "13px", fontWeight: 600,
        color: "#475569", marginBottom: "7px"
      }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: "100%", padding: "10px 14px",
          border: "1px solid #e2e8f0", borderRadius: "8px",
          fontSize: "14px", color: disabled ? "#94a3b8" : "#1e293b",
          background: disabled ? "#f8fafc" : "#fff",
          outline: "none", boxSizing: "border-box",
          transition: "border-color 0.2s"
        }}
        onFocus={(e) => { if (!disabled) e.target.style.borderColor = "#3b82f6"; }}
        onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; }}
      />
      {extra}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Settings() {
  const navigate = useNavigate();

  // ── Profile state ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({
    fullname: "", email: "", phone: "", designation: "", department: ""
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving,  setProfileSaving]  = useState(false);

  // ── Password state ─────────────────────────────────────────────────────────
  const [passwords, setPasswords] = useState({
    current: "", newPass: "", confirm: ""
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [pwdSaving,   setPwdSaving]   = useState(false);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load profile on mount ──────────────────────────────────────────────────
  useEffect(() => {
    const loadProfile = async () => {
      setProfileLoading(true);
      try {
        // Try API first
        const res = await api.get("/employees/my-profile");
        const d = res.data;
        setProfile({
          fullname:    d.fullname    || "",
          email:       d.email       || "",
          phone:       d.phone       || "",
          designation: d.designation || "",
          department:  d.department  || "",
        });
      } catch {
        // Fallback: load from localStorage
        try {
          const stored = localStorage.getItem("user");
          if (stored) {
            const u = JSON.parse(stored);
            setProfile({
              fullname:    u.fullname    || "",
              email:       u.email       || "",
              phone:       u.phone       || "",
              designation: u.designation || "",
              department:  u.department  || "",
            });
          }
        } catch { /* ignore */ }
      } finally {
        setProfileLoading(false);
      }
    };
    loadProfile();
  }, []);

  // ── Save profile ───────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!profile.fullname.trim()) {
      showToast("error", "Full name is required.");
      return;
    }
    setProfileSaving(true);
    try {
      await api.put("/employees/update-profile", {
        fullname: profile.fullname.trim(),
        phone:    profile.phone.trim(),
      });

      // Also update localStorage so dashboard reflects the change
      const stored = localStorage.getItem("user");
      if (stored) {
        const u = JSON.parse(stored);
        localStorage.setItem("user", JSON.stringify({
          ...u,
          fullname: profile.fullname.trim(),
          phone:    profile.phone.trim(),
        }));
      }

      showToast("success", "Profile updated successfully!");
    } catch (err) {
      showToast("error", err.response?.data?.msg || "Failed to save profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Change password ────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!passwords.current || !passwords.newPass || !passwords.confirm) {
      showToast("error", "Please fill in all password fields.");
      return;
    }
    if (passwords.newPass.length < 6) {
      showToast("error", "New password must be at least 6 characters.");
      return;
    }
    if (passwords.newPass !== passwords.confirm) {
      showToast("error", "New passwords do not match.");
      return;
    }
    setPwdSaving(true);
    try {
      await api.put("/auth/change-password", {
        current_password: passwords.current,
        new_password:     passwords.newPass,
      });
      showToast("success", "Password changed successfully!");
      setPasswords({ current: "", newPass: "", confirm: "" });
    } catch (err) {
      showToast("error", err.response?.data?.msg || "Failed to change password.");
    } finally {
      setPwdSaving(false);
    }
  };

  // ── Password eye toggle helper ─────────────────────────────────────────────
  const PasswordInput = ({ label, fieldKey, show, onToggle }) => (
    <div style={{ marginBottom: "18px" }}>
      <label style={{
        display: "block", fontSize: "13px", fontWeight: 600,
        color: "#475569", marginBottom: "7px"
      }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"}
          value={passwords[fieldKey]}
          onChange={(e) => setPasswords(p => ({ ...p, [fieldKey]: e.target.value }))}
          style={{
            width: "100%", padding: "10px 42px 10px 14px",
            border: "1px solid #e2e8f0", borderRadius: "8px",
            fontSize: "14px", color: "#1e293b",
            background: "#fff", outline: "none", boxSizing: "border-box",
            transition: "border-color 0.2s"
          }}
          onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; }}
          onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; }}
        />
        <button
          type="button"
          onClick={onToggle}
          style={{
            position: "absolute", right: "12px", top: "50%",
            transform: "translateY(-50%)", background: "none",
            border: "none", cursor: "pointer", color: "#94a3b8", padding: 0
          }}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );

  // ── Save button ────────────────────────────────────────────────────────────
  const SaveButton = ({ onClick, loading, label }) => (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: "10px 28px", borderRadius: "8px", border: "none",
        background: loading ? "#93c5fd" : "#3b82f6",
        color: "#fff", fontWeight: 600, fontSize: "14px",
        cursor: loading ? "not-allowed" : "pointer",
        transition: "background 0.2s"
      }}
    >
      {loading ? "Saving..." : label}
    </button>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: "#f0f4f8",
      padding: "32px 24px", fontFamily: "'Segoe UI', sans-serif"
    }}>
      <Toast toast={toast} />

      <div style={{ maxWidth: "700px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "28px" }}>
          <button
            onClick={() => navigate("/employee-dashboard")}
            style={{
              background: "#fff", border: "1px solid #e2e8f0",
              borderRadius: "8px", padding: "8px 10px",
              cursor: "pointer", color: "#475569",
              display: "flex", alignItems: "center"
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#1e293b" }}>Settings</h1>
            <p style={{ color: "#64748b", fontSize: "14px" }}>Manage your profile and account security.</p>
          </div>
        </div>

        {/* ── Personal Information ── */}
        <Card title="Personal Information" icon={<User size={18} />}>
          {profileLoading ? (
            <p style={{ color: "#94a3b8", fontSize: "14px" }}>Loading profile...</p>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
                <Field
                  label="Full Name *"
                  value={profile.fullname}
                  onChange={(e) => setProfile(p => ({ ...p, fullname: e.target.value }))}
                  placeholder="Your full name"
                />
                <Field
                  label="Phone Number"
                  value={profile.phone}
                  onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))}
                  placeholder="e.g. 9876543210"
                />
                <Field
                  label="Email Address"
                  value={profile.email}
                  disabled
                  placeholder="your@email.com"
                />
                <Field
                  label="Designation"
                  value={profile.designation}
                  disabled
                  placeholder="—"
                />
                <Field
                  label="Department"
                  value={profile.department}
                  disabled
                  placeholder="—"
                />
              </div>
              <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "18px" }}>
                * Email, designation, and department can only be updated by HR/Admin.
              </p>
              <SaveButton
                onClick={handleSaveProfile}
                loading={profileSaving}
                label="Save Profile"
              />
            </>
          )}
        </Card>

        {/* ── Change Password ── */}
        <Card title="Change Password" icon={<Lock size={18} />}>
          <PasswordInput
            label="Current Password"
            fieldKey="current"
            show={showCurrent}
            onToggle={() => setShowCurrent(v => !v)}
          />
          <PasswordInput
            label="New Password"
            fieldKey="newPass"
            show={showNew}
            onToggle={() => setShowNew(v => !v)}
          />
          <PasswordInput
            label="Confirm New Password"
            fieldKey="confirm"
            show={showNew}
            onToggle={() => setShowNew(v => !v)}
          />
          {passwords.newPass && passwords.confirm && passwords.newPass !== passwords.confirm && (
            <p style={{ color: "#dc2626", fontSize: "13px", marginBottom: "14px" }}>
              ⚠ Passwords do not match
            </p>
          )}
          <SaveButton
            onClick={handleChangePassword}
            loading={pwdSaving}
            label="Change Password"
          />
        </Card>

      </div>
    </div>
  );
}
