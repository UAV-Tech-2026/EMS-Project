import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { authApi } from "../utils/api";
import "../styles/Login.css";
import OtpVerification from "./OtpVerification";

export default function Login() {
  const navigate = useNavigate();

  const location = useLocation();
const sessionMsg =
  location.state?.reason === "inactivity" ? "You were logged out due to inactivity." :
  location.state?.reason === "expired"    ? "Your session expired. Please log in again." :
  null;

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("login");
  const [tempToken, setTempToken] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const [qrCode, setQrCode] = useState("");

  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetOtp, setResetOtp] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const username = e.target.username.value;
    const password = e.target.password.value;

    try {
      const res = await authApi.post("/login", { username, password });

      if (res.data?.requires2FA && res.data?.tempToken) {
        setTempToken(res.data.tempToken);
        setSetupRequired(res.data.setupRequired || false);
        setQrCode(res.data.qrCode || "");
        setStep("otp");
      } else if (res.data?.token && res.data?.user) {
        finalizeLogin(res.data);
      } else {
        setError("Invalid login response");
      }
    } catch (err) {
      setError(err.response?.data?.msg || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  
  const finalizeLogin = ({ token, user }) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));

    const role = (user.role || "").toLowerCase().trim();
    console.log("Login finalized. User role:", role);
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="emslogin__wrapper">
      <div className="emslogin__card-wrap">
       <div className="emslogin__card">

        <div className="emslogin__header">
          <div className="emslogin__logo" style={{ marginBottom: '24px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: '#fff',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 16px rgba(0,0,0,0.06)',
              border: '1.5px solid #f1f5f9'
            }}>
              <img
                src={import.meta.env.VITE_LOGO_URL || "/logo.jpg"}
                alt="Logo"
                style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                onError={(e) => {
                  if (e.target.src !== window.location.origin + "/logo.jpg") {
                    e.target.src = "/logo.jpg";
                  } else {
                    e.target.style.display = 'none';
                    e.target.parentNode.innerText = 'UAV';
                  }
                }}
              />
            </div>
          </div>

          <h1 className="emslogin__title">Work Stock Pro</h1>
        </div>

        {/* LOGIN */}
        {step === "login" && (
          <div className="emslogin__form">
            <form onSubmit={handleLogin} style={{ display: "contents" }}>
              <div className="emslogin__field">
                <label className="emslogin__label">Username</label>
                <input
                  name="username"
                  className="emslogin__input"
                  placeholder="Enter your username"
                  required
                  disabled={loading}
                />
              </div>

              <div className="emslogin__field">
                <label className="emslogin__label">Password</label>
                <input
                  type="password"
                  name="password"
                  className="emslogin__input"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
              </div>

              {error && <div className="emslogin__error">{error}</div>}

               {sessionMsg && (
                <div style={{
                  background: "#fef3c7", color: "#92400e",
                  border: "1px solid #fde68a", borderRadius: 8,
                  padding: "10px 14px", fontSize: 13, fontWeight: 600,
                  marginBottom: 14, display: "flex", alignItems: "center", gap: 8
                }}>
                  ⚠️ {sessionMsg}
                </div>
              )}

              {error && <div className="emslogin__error">{error}</div>}

              <button className="emslogin__btn-primary" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <button className="emslogin__btn-secondary" onClick={() => setStep("forgot")}>
              Forgot Password?
            </button>
          </div>
        )}

        
        {step === "otp" && (
          <OtpVerification
            tempToken={tempToken}
            setupRequired={setupRequired}
            qrCode={qrCode}
            onBack={() => setStep("login")}
            onSuccess={finalizeLogin}
          />
        )}

        
        {step === "forgot" && (
          <div className="emslogin__form">
            <div className="emslogin__field">
              <label className="emslogin__label">Email Address</label>
              <input
                type="email"
                className="emslogin__input"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button
              className="emslogin__btn-primary"
              disabled={loading}
              onClick={async () => {
                if (!email) return setError("Email required");
                try {
                  setLoading(true);
                  const res = await authApi.post("/forgot-password", { email });
                  setResetToken(res.data.resetToken);
                  setStep("reset");
                } catch (err) {
                  setError("Error sending OTP");
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>

            <button className="emslogin__btn-secondary" onClick={() => setStep("login")}>
              Back to Login
            </button>
          </div>
        )}

        
        {step === "reset" && (
          <div className="emslogin__form">
            <div className="emslogin__field">
              <label className="emslogin__label">Verification Code</label>
              <input
                className="emslogin__input"
                placeholder="6-digit code"
                value={resetOtp}
                onChange={(e) => setResetOtp(e.target.value)}
              />
            </div>
            <div className="emslogin__field">
              <label className="emslogin__label">New Password</label>
              <input
                type="password"
                className="emslogin__input"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <button
              className="emslogin__btn-primary"
              disabled={loading}
              onClick={async () => {
                try {
                  setLoading(true);
                  await authApi.post("/reset-password", {
                    resetToken,
                    otp: resetOtp,
                    newPassword,
                  });
                  alert("Password reset successful");
                  setStep("login");
                } catch {
                  setError("Reset failed");
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>

            <button className="emslogin__btn-secondary" onClick={() => setStep("login")}>
              Cancel
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
