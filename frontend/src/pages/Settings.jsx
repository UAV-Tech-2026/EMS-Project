import React, { useState, useEffect, useRef } from "react";
import { User, Lock, CheckCircle, AlertCircle, ArrowLeft, Camera, Loader2 } from "lucide-react";
import { api, API_URL } from "../utils/api";
import { useNavigate } from "react-router-dom";


function Toast({ toast }) {
  if (!toast) return null;
  const isOk = toast.type === "success";
  return (
    <div style={{
      position: "fixed", top: "24px", right: "24px", zIndex: 9999,
      background: isOk ? "#ecfdf5" : "#fff1f2",
      color: isOk ? "#065f46" : "#9f1239",
      border: `1px solid ${isOk ? "#a7f3d0" : "#fecdd3"}`,
      borderRadius: "12px", padding: "16px 24px",
      display: "flex", alignItems: "center", gap: "12px",
      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)", fontSize: "14px", fontWeight: 600,
      minWidth: "300px", animation: "slideIn 0.3s ease-out"
    }}>
      {isOk ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
      {toast.msg}
      <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  );
}

function Card({ title, icon, children, subtitle }) {
  return (
    <div style={{
      background: "#fff", borderRadius: "16px",
      border: "1px solid #e2e8f0", marginBottom: "24px",
      overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
    }}>
      <div style={{
        padding: "20px 24px", borderBottom: "1px solid #f1f5f9",
        display: "flex", alignItems: "center", gap: "12px"
      }}>
        <div style={{
          width: "40px", height: "40px", background: "#f5f3ff",
          borderRadius: "10px", display: "flex", alignItems: "center",
          justifyContent: "center", color: "#6366f1"
        }}>{icon}</div>
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>{title}</h2>
          {subtitle && <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>{subtitle}</p>}
        </div>
      </div>
      <div style={{ padding: "24px" }}>{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, disabled }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <label style={{
        display: "block", fontSize: "12px", fontWeight: 700,
        color: "#64748b", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em"
      }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: "100%", padding: "12px 14px",
          border: "1px solid #e2e8f0", borderRadius: "10px",
          fontSize: "14px", color: disabled ? "#94a3b8" : "#0f172a",
          background: disabled ? "#f8fafc" : "#fff",
          outline: "none", boxSizing: "border-box",
          transition: "all 0.2s"
        }}
        onFocus={(e) => { if (!disabled) { e.target.style.borderColor = "#6366f1"; e.target.style.boxShadow = "0 0 0 4px rgba(99, 102, 241, 0.1)"; } }}
        onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }}
      />
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState({
    fullname: "", email: "", phone: "", designation: "", department: "", profile_pic: null
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });
  const [pwdSaving, setPwdSaving] = useState(false);

  const [toast, setToast] = useState(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const loadProfile = async () => {
      setProfileLoading(true);
      try {
        const res = await api.get("/employees/my-profile");
        const d = res.data;
        setProfile({
          fullname: d.fullname || "",
          email: d.email || "",
          phone: d.phone || "",
          designation: d.designation || "",
          department: d.department || "",
          profile_pic: d.profile_pic ? `${API_URL}${d.profile_pic}` : null
        });
      } catch (err) {
        showToast("error", "Failed to load profile data.");
      } finally {
        setProfileLoading(false);
      }
    };
    loadProfile();
  }, []);

  const syncsessionStorage = (updates) => {
    try {
      const stored = sessionStorage.getItem("user");
      if (stored) {
        const u = JSON.parse(stored);
        sessionStorage.setItem("user", JSON.stringify({ ...u, ...updates }));
      }
    } catch (e) { console.error(e); }
  };

  const handleSaveProfile = async () => {
    if (!profile.fullname.trim()) {
      showToast("error", "Full name is required.");
      return;
    }
    setProfileSaving(true);
    try {
      const stored = sessionStorage.getItem("user");
      let originalPhone = "";
      if (stored) {
        originalPhone = JSON.parse(stored).phone || "";
      }

      const newPhone = profile.phone.trim();
      const phoneChanged = (newPhone !== originalPhone) && (newPhone !== "");

      await api.put("/employees/update-profile", {
        fullname: profile.fullname.trim(),
        phone: newPhone,
      });
      syncsessionStorage({ fullname: profile.fullname.trim(), phone: newPhone });
      
      if (phoneChanged) {
        showToast("success", "Profile updated! Please log out and back in to set up your new 2FA (QR code).");
      } else {
        showToast("success", "Profile updated successfully!");
      }
    } catch (err) {
      showToast("error", err.response?.data?.msg || "Failed to save profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast("error", "File too large. Max 2MB allowed.");
      return;
    }
    const formData = new FormData();
    formData.append("profile_pic", file);
    setPhotoUploading(true);
    try {
      const res = await api.post("/employees/upload-profile-pic", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const newPic = `${API_URL}${res.data.profilePic}`;
      setProfile(p => ({ ...p, profile_pic: newPic }));
      syncsessionStorage({ profilePic: newPic, profile_pic: res.data.profilePic });
      showToast("success", "Profile photo updated!");
    } catch (err) {
      showToast("error", "Failed to upload photo.");
    } finally {
      setPhotoUploading(false);
    }
  };

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
        new_password: passwords.newPass,
      });
      setPasswords({ current: "", newPass: "", confirm: "" });
      // Password changed → TOTP is reset on server → must re-login to get new QR scanner
      showToast("success", "Password updated! Redirecting to login to scan your new 2FA QR code…");
      setTimeout(() => {
        sessionStorage.clear();
        navigate("/login");
      }, 3000);
    } catch (err) {
      showToast("error", err.response?.data?.msg || "Failed to change password.");
    } finally {
      setPwdSaving(false);
    }
  };

 
  const handleBack = () => {
    const role = JSON.parse(sessionStorage.getItem("user"))?.role;
    if (role === "super_admin") navigate("/super-admin-dashboard");
    else if (role === "admin") navigate("/admin-dashboard");
    else navigate("/employee-dashboard");
  };

  const SaveButton = ({ onClick, loading, label }) => (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: "12px 28px", borderRadius: "10px", border: "none",
        background: loading ? "#94a3b8" : "#4f46e5",
        color: "#fff", fontWeight: 700, fontSize: "14px",
        cursor: loading ? "not-allowed" : "pointer",
        transition: "all 0.2s", boxShadow: loading ? "none" : "0 4px 12px rgba(79, 70, 229, 0.2)"
      }}
    >
      {loading ? "Processing..." : label}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "40px 24px", fontFamily: "'Outfit', sans-serif" }}>
      <Toast toast={toast} />

      <div style={{ maxWidth: "760px", margin: "0 auto" }}>

       
        <button
          onClick={handleBack}
          style={{
            background: "#fff", border: "1px solid #e2e8f0", padding: "8px 16px",
            borderRadius: "10px", cursor: "pointer", color: "#64748b", fontWeight: 700,
            display: "flex", alignItems: "center", gap: "8px", marginBottom: "32px",
            fontSize: "13px"
          }}
        >
          <ArrowLeft size={16} /> Dashboard
        </button>

        <header style={{ marginBottom: "32px", display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{
            width: 48, height: 48,
            background: "#ffffff",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            overflow: "hidden",
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)"
          }}>
            <img 
              src={import.meta.env.VITE_LOGO_URL || "/logo.jpg"} 
              alt="Logo" 
              style={{ width: 40, height: 40, objectFit: "contain" }}
              onError={(e) => { 
                if (e.target.src !== window.location.origin + "/logo.jpg") {
                  e.target.src = "/logo.jpg";
                } else {
                  e.target.style.display = 'none'; 
                }
              }}
            />
          </div>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 900, color: "#0f172a", margin: 0, letterSpacing: "-0.03em" }}>Account Settings</h1>
            <p style={{ color: "#64748b", fontSize: "15px", margin: "4px 0 0" }}>Update your photo, personal info and security preferences.</p>
          </div>
        </header>

       
        {JSON.parse(sessionStorage.getItem("user"))?.role === "super_admin" && (
          <Card title="Profile Photograph" icon={<Camera size={20} />} subtitle="Visible on your dashboard and ID cards.">
            <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
              <div style={{ position: "relative" }}>
                <div style={{
                  width: "100px", height: "100px", borderRadius: "50%",
                  background: "#f1f5f9", overflow: "hidden", border: "4px solid #fff",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  {profile.profile_pic ? (
                    <img src={profile.profile_pic} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <User size={48} color="#cbd5e1" />
                  )}
                  {photoUploading && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Loader2 className="animate-spin" color="#6366f1" />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoUploading}
                    style={{
                      background: "#6366f1", color: "#fff", border: "none", padding: "10px 18px",
                      borderRadius: "8px", fontWeight: 700, fontSize: "13px", cursor: "pointer"
                    }}
                  >
                    Upload New Photo
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" style={{ display: "none" }} />
                </div>
                <p style={{ margin: "12px 0 0", fontSize: "12px", color: "#94a3b8", lineHeight: 1.5 }}>
                  Recommended size: 400x400px. <br /> JPEG or PNG, max 2MB.
                </p>
              </div>
            </div>
          </Card>
        )}

        
        <Card title="Personal Details" icon={<User size={20} />}>
          {profileLoading ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
              <Loader2 className="animate-spin" size={24} style={{ margin: "0 auto" }} />
              <p style={{ marginTop: "12px", fontSize: "14px" }}>Fetching profile details...</p>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                <Field
                  label="Display Name *"
                  value={profile.fullname}
                  onChange={(e) => setProfile(p => ({ ...p, fullname: e.target.value }))}
                />
                <Field
                  label="Contact Phone"
                  value={profile.phone}
                  onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))}
                />
                <Field label="Work Email" value={profile.email} disabled />
                <Field label="Designation" value={profile.designation} disabled />
              </div>
              <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "24px", background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                <strong>Note:</strong> Official details like Email and Designation are managed by HR/Admin. Please contact support to update these.
              </p>
              <SaveButton onClick={handleSaveProfile} loading={profileSaving} label="Save Profile Changes" />
            </>
          )}
        </Card>

        
        {!profileLoading && (profile.adhar_path || profile.address_path) && (
          <Card title="Verification Documents" icon={<CheckCircle size={20} />} subtitle="Google Drive links provided during enrollment.">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {profile.adhar_path && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0"
                }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>Valid Proof</p>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>Stored Google Drive Link</p>
                  </div>
                  <a href={profile.adhar_path} target="_blank" rel="noopener noreferrer" style={{
                    padding: "8px 16px", background: "#6366f1", color: "#fff",
                    borderRadius: "8px", fontSize: "12px", fontWeight: 700, textDecoration: "none"
                  }}>View on Drive</a>
                </div>
              )}
              {profile.address_path && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0"
                }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>Address Proof</p>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>Stored Google Drive Link</p>
                  </div>
                  <a href={profile.address_path} target="_blank" rel="noopener noreferrer" style={{
                    padding: "8px 16px", background: "#6366f1", color: "#fff",
                    borderRadius: "8px", fontSize: "12px", fontWeight: 700, textDecoration: "none"
                  }}>View on Drive</a>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ── 4. Password / Security ── */}
        <Card title="Security" icon={<Lock size={20} />} subtitle="Change your password regularly for better security.">
          <div style={{ maxWidth: "400px" }}>
            <Field label="Current Password" type="password" value={passwords.current} onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))} />
            <Field label="New Password" type="password" value={passwords.newPass} onChange={e => setPasswords(p => ({ ...p, newPass: e.target.value }))} />
            <Field label="Confirm New Password" type="password" value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} />
            <SaveButton onClick={handleChangePassword} loading={pwdSaving} label="Update Password" />
          </div>
        </Card>

      </div>
    </div>
  );
}
