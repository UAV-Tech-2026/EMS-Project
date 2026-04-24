import React, { useState } from "react";
import { authApi } from "../utils/api";
import "../styles/Login.css";

// ✅ FIX: Removed useNavigate — navigation is now handled by parent via onSuccess()
// This ensures the same finalizeLogin logic (correct paths, localStorage) is always used
export default function OtpVerification({ tempToken, setupRequired, qrCode, onBack, onSuccess }) {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return setError("Please enter 6-digit code");

    setLoading(true);
    setError("");
    try {
      const res = await authApi.post("/verify-otp", {
        tempToken,
        otp,
        isSetup: setupRequired,
      });

      if (res.data.token && res.data.user) {
        // ✅ FIX: Delegate to parent's finalizeLogin instead of navigating here
        // This guarantees localStorage is set and the correct route is used
        onSuccess({ token: res.data.token, user: res.data.user });
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
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <h2 className="emslogin__title" style={{ fontSize: "20px", marginBottom: "8px" }}>
          {setupRequired ? "Security Setup" : "Two-Factor Authentication"}
        </h2>
        <p style={{ fontSize: "14px", color: "var(--lg-muted)" }}>
          {setupRequired
            ? "Protect your account with Google Authenticator"
            : "Enter the code from your authenticator app"}
        </p>
      </div>

      {setupRequired && qrCode && (
        <div style={{
          textAlign: "center",
          marginBottom: "28px",
          background: "rgba(31, 78, 121, 0.03)",
          padding: "24px",
          borderRadius: "16px",
          border: "1px dashed rgba(31, 78, 121, 0.2)"
        }}>
          <p style={{ fontSize: "12px", fontWeight: "600", color: "#1F4E79", marginBottom: "14px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Step 1: Scan QR Code
          </p>
          <div style={{
            display: "inline-block",
            padding: "12px",
            background: "#fff",
            borderRadius: "16px",
            boxShadow: "0 10px 20px rgba(0,0,0,0.06)"
          }}>
            <img src={qrCode} alt="QR Code" style={{ width: "160px", display: "block" }} />
          </div>
          <p style={{ fontSize: "11px", color: "#64748b", marginTop: "14px", lineHeight: "1.5" }}>
            Open Google Authenticator and scan this code <br/> to link your account.
          </p>
        </div>
      )}

      <form onSubmit={handleVerify}>
        <div className="emslogin__field" style={{ marginBottom: "24px" }}>
          <label className="emslogin__label" style={{ textAlign: "center", display: "block", marginBottom: "12px" }}>
            {setupRequired ? "Step 2: Enter 6-Digit Code" : "Verification Code"}
          </label>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="emslogin__input"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000 000"
              required
              autoFocus
              disabled={loading}
              style={{
                textAlign: "center",
                letterSpacing: "12px",
                fontSize: "28px",
                fontWeight: "800",
                color: "#1F4E79",
                height: "70px",
                background: "#fcfdfe"
              }}
            />
          </div>
        </div>

        {error && <div className="emslogin__error" style={{ marginBottom: "20px" }}>{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button
            type="submit"
            className="emslogin__btn-primary"
            disabled={loading || otp.length !== 6}
            style={{ margin: 0 }}
          >
            {loading ? "Verifying..." : "Verify & Sign In"}
          </button>

          <button
            type="button"
            className="emslogin__btn-secondary"
            onClick={onBack}
            disabled={loading}
          >
            ← Back to Login
          </button>
        </div>
      </form>
    </div>
  );
}
