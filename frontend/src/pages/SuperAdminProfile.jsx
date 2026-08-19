import { useState } from "react";
import axios from "axios";

export default function SuperAdminProfile({ onClose }) {
  const user = JSON.parse(sessionStorage.getItem("user"));
  const [formData, setFormData] = useState({
    name: user?.fullname || user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    password: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleUpdate = async () => {
    setLoading(true);
    setError("");
    try {
      const token = sessionStorage.getItem("token");
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/auth/users/update-profile`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Merge backend response with existing session to keep token/permissions
      const updatedUser = { ...user, ...response.data };
      sessionStorage.setItem("user", JSON.stringify(updatedUser));
      
      alert("Profile updated successfully!");
      if (onClose) onClose();
      window.location.reload(); // Refresh to update all dashboard name instances
    } catch (err) {
      console.error("Update failed:", err);
      const msg = err.response?.data?.msg || "Failed to update profile. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const initials = formData.name
    ? formData.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "SA";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap');

        .pm-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.35);
          backdrop-filter: blur(3px);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000;
          font-family: 'DM Sans', sans-serif;
        }
        .pm-modal {
          background: #fff;
          border-radius: 20px;
          padding: 36px 40px 40px;
          width: 420px;
          box-shadow: 0 24px 60px rgba(0,0,0,0.15);
          position: relative;
          animation: pm-slide-up 0.22s ease;
        }
        @keyframes pm-slide-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pm-close {
          position: absolute; top: 18px; right: 18px;
          width: 32px; height: 32px; border-radius: 50%;
          border: 1.5px solid #e2e5ea; background: transparent;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          color: #9aa0ab; font-size: 15px; transition: all 0.15s;
        }
        .pm-close:hover { background: #f5f6f8; color: #333; border-color: #ccc; }

        .pm-title {
          font-family: 'DM Serif Display', serif;
          font-size: 26px; color: #111827;
          margin: 0 0 4px; letter-spacing: -0.3px;
        }
        .pm-subtitle { font-size: 13.5px; color: #9aa0ab; margin: 0 0 24px; }

        .pm-avatar-row {
          display: flex; align-items: center; gap: 14px; margin-bottom: 26px;
        }
        .pm-avatar {
          width: 52px; height: 52px; border-radius: 50%;
          background: linear-gradient(135deg, #3b6ef8, #7c3aed);
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 18px; font-weight: 600; flex-shrink: 0;
        }
        .pm-avatar-name { font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 2px; }
        .pm-avatar-role { font-size: 12.5px; color: #9aa0ab; }

        .pm-fields { display: flex; flex-direction: column; gap: 14px; margin-bottom: 10px; }

        .pm-field label {
          display: block; font-size: 11.5px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.7px;
          color: #6b7280; margin-bottom: 6px;
        }
        .pm-field input {
          width: 100%; padding: 11px 14px; box-sizing: border-box;
          border: 1.5px solid #e5e7eb; border-radius: 10px;
          font-size: 14.5px; font-family: 'DM Sans', sans-serif;
          color: #111827; background: #fafafa; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .pm-field input::placeholder { color: #c0c4cc; }
        .pm-field input:focus {
          border-color: #3b6ef8; background: #fff;
          box-shadow: 0 0 0 3.5px rgba(59,110,248,0.10);
        }

        .pm-error {
          font-size: 13px; color: #dc2626;
          background: #fef2f2; border: 1px solid #fecaca;
          border-radius: 8px; padding: 9px 12px; margin-top: 12px;
        }

        .pm-divider { height: 1px; background: #f0f0f2; margin: 24px 0; }

        .pm-actions { display: flex; justify-content: flex-end; gap: 10px; }

        .pm-btn-cancel {
          padding: 10px 20px; border-radius: 9px;
          border: 1.5px solid #e5e7eb; background: transparent;
          font-size: 14px; font-family: 'DM Sans', sans-serif;
          font-weight: 500; color: #6b7280; cursor: pointer; transition: all 0.15s;
        }
        .pm-btn-cancel:hover { background: #f5f6f8; color: #333; }

        .pm-btn-save {
          padding: 10px 26px; border-radius: 9px; border: none;
          background: #2563eb; font-size: 14px; font-family: 'DM Sans', sans-serif;
          font-weight: 600; color: #fff; cursor: pointer; transition: all 0.15s;
          box-shadow: 0 2px 8px rgba(37,99,235,0.25);
          display: flex; align-items: center; gap: 8px; min-width: 120px; justify-content: center;
        }
        .pm-btn-save:hover:not(:disabled) {
          background: #1d4ed8; box-shadow: 0 4px 14px rgba(37,99,235,0.32);
          transform: translateY(-1px);
        }
        .pm-btn-save:disabled { opacity: 0.65; cursor: not-allowed; transform: none; }

        .pm-spinner {
          width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #fff; border-radius: 50%;
          animation: pm-spin 0.7s linear infinite;
        }
        @keyframes pm-spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="pm-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
        <div className="pm-modal">
          <button className="pm-close" onClick={onClose}>✕</button>

          <h2 className="pm-title">Edit Profile</h2>
          <p className="pm-subtitle">Update your account information</p>

          {(() => {
            let pic = user?.profilePic || user?.profile_pic;
            const baseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
            if (pic && pic.startsWith("/uploads")) {
              pic = `${baseUrl}${pic}`;
            }
            return (
              <div className="pm-avatar-row">
                {pic ? (
                  <img src={pic} alt="Avatar" style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div className="pm-avatar">{initials}</div>
                )}
                <div>
                  <div className="pm-avatar-name">{formData.name || "Super Admin"}</div>
                  <div className="pm-avatar-role">Administrator · {user?.email?.split("@")[1] || "uavtech.ai"}</div>
                </div>
              </div>
            );
          })()}

          <div className="pm-fields">
            <div className="pm-field">
              <label>Full Name</label>
              <input 
                name="name" 
                value={formData.name} 
                onChange={handleChange}
                placeholder="Enter full name"
              />
            </div>
            <div className="pm-field">
              <label>Email Address</label>
              <input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="you@uavtech.ai" />
            </div>
            <div className="pm-field">
              <label>Phone Number</label>
              <input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+91-XXXXXXXXXX"
                required
              />
            </div>
            <div className="pm-field">
              <label>New Password (Leave blank to keep current)</label>
              <input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && <div className="pm-error">{error}</div>}

          <div className="pm-divider" />

          <div className="pm-actions">
            <button className="pm-btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
            <button className="pm-btn-save" onClick={handleUpdate} disabled={loading}>
              {loading ? <><span className="pm-spinner" /> Saving…</> : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
