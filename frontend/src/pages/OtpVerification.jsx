import React, { useState } from "react";
import { authApi } from "../utils/api";
import "../styles/Login.css";


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
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <h2 className="emslogin__title" style={{ fontSize: "20px", marginBottom: "8px" }}>
          {setupRequired ? "Set Up Two-Factor Authentication" : "Two-Factor Authentication"}
        </h2>
        <p style={{ fontSize: "14px", color: "var(--lg-muted)" }}>
          {setupRequired
            ? "Scan this QR code with Google Authenticator, then enter the 6-digit code below."
            : "Enter the code from your authenticator app"}
        </p>
      </div>

      {setupRequired && qrCode && (
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div
            style={{
              display: "inline-block",
              padding: "12px",
              background: "#ffffff",
              border: "2px solid #e2e8f0",
              borderRadius: "16px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
          >
            <img
              src={qrCode}
              alt="2FA QR Code"
              style={{ width: "180px", height: "180px", display: "block" }}
            />
          </div>
          <p style={{ fontSize: "12px", color: "#64748b", marginTop: "8px" }}>
            Open Google Authenticator &rarr; Scan QR code
          </p>
        </div>
      )}



      <form onSubmit={handleVerify}>
        <div className="emslogin__field" style={{ marginBottom: "24px" }}>
          <label htmlFor="otp-input" className="emslogin__label" style={{ textAlign: "center", display: "block", marginBottom: "12px" }}>
            Verification Code
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="otp-input"
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
