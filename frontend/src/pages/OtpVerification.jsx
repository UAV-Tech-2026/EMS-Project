import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../utils/api";
import "../styles/Login.css";

export default function OtpVerification({ tempToken, setupRequired, qrCode, onBack }) {
  const navigate = useNavigate();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return setError("Please enter 6-digit code");
    
    setLoading(true);
    setError("");
    try {
      // API call to verify the OTP (Google Authenticator or email OTP)
      const res = await authApi.post("/verify-otp", {
        tempToken,
        otp,
        isSetup: setupRequired,
      });

      if (res.data.token && res.data.user) {
        // Success: Store credentials and navigate to the appropriate dashboard
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        
        const { role } = res.data.user;
        if (role === "super_admin")  navigate("/super-admin-dashboard");
        else if (role === "admin")   navigate("/admin-dashboard");
        else                         navigate("/employee-dashboard");
      } else {
        setError("Invalid response from server");
      }
    } catch (err) {
      setError(err.response?.data?.msg || "Verification failed. Check your code and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="emslogin__form">
      <p className="emslogin__section-title">
        {setupRequired ? "Security Setup" : "Two-Factor Auth"}
      </p>
      
      {setupRequired && qrCode && (
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "10px" }}>
            Scan this QR code with Google Authenticator app on your phone
          </p>
          <img src={qrCode} alt="QR Code" style={{ 
            width: "160px", 
            borderRadius: "12px", 
            padding: "10px", 
            background: "#fff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
          }} />
        </div>
      )}

      <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px", textAlign: "center" }}>
        {setupRequired 
          ? "Enter the 6-digit code from your app to complete setup." 
          : "Enter the code from your Google Authenticator app to continue."}
      </p>

      <form onSubmit={handleVerify}>
        <div className="emslogin__field">
          <label className="emslogin__label">6-Digit Code</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="emslogin__input"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            required
            autoFocus
            disabled={loading}
            style={{ 
              textAlign: "center", 
              letterSpacing: "8px", 
              fontSize: "24px", 
              fontWeight: "800",
              color: "#1F4E79"
            }}
          />
        </div>

        {error && <div className="emslogin__error">{error}</div>}

        <button 
          type="submit" 
          className="emslogin__btn-primary" 
          disabled={loading || otp.length !== 6}
          style={{ marginTop: "10px" }}
        >
          {loading ? "Verifying..." : "Verify & Login"}
        </button>

        <button 
          type="button" 
          className="emslogin__btn-secondary" 
          onClick={onBack} 
          disabled={loading}
        >
          ← Back to Login
        </button>
      </form>
    </div>
  );
}
