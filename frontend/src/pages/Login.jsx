
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { authApi } from "../utils/api";
import { Eye, EyeOff } from "lucide-react";
import "../styles/Login.css";
import OtpVerification from "./OtpVerification";

export default function Login() {
  const navigate = useNavigate();

  const location = useLocation();
  const sessionMsg =
    location.state?.reason === "inactivity" ? "You were logged out due to inactivity." :
      location.state?.reason === "expired" ? "Your session expired. Please log in again." :
        null;

  useEffect(() => {
    const checkSession = () => {
      const token = sessionStorage.getItem("token");
      if (!token) {
        sessionStorage.clear();
        return;
      }
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {

          sessionStorage.clear();
        } else {

          navigate("/dashboard", { replace: true });
        }
      } catch {
        sessionStorage.clear();
      }
    };


    const timer = setTimeout(checkSession, 0);

    const handlePageShow = (e) => {
      if (e.persisted) {
        checkSession();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [navigate]);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


  const [step, setStep] = useState(() => sessionStorage.getItem("login_step") || "login");
  const [tempToken, setTempToken] = useState(() => sessionStorage.getItem("login_tempToken") || "");
  const [setupRequired, setSetupRequired] = useState(() => sessionStorage.getItem("login_setupRequired") === "true");
  const [qrCode, setQrCode] = useState(() => sessionStorage.getItem("login_qrCode") || "");

  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [phoneInput, setPhoneInput] = useState("");


  const saveLoginStep = (newStep, token = tempToken, setup = setupRequired, qr = qrCode) => {
    sessionStorage.setItem("login_step", newStep);
    sessionStorage.setItem("login_tempToken", token);
    sessionStorage.setItem("login_setupRequired", String(setup));
    sessionStorage.setItem("login_qrCode", qr);
    setStep(newStep);
  };

  const clearLoginStep = () => {
    sessionStorage.removeItem("login_step");
    sessionStorage.removeItem("login_tempToken");
    sessionStorage.removeItem("login_setupRequired");
    sessionStorage.removeItem("login_qrCode");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const username = e.target.username.value;
    const password = e.target.password.value;

    try {
      const res = await authApi.post("/login", { username, password });

      if (res.data?.requiresPhoneCheck && res.data?.tempToken) {
        setTempToken(res.data.tempToken);
        saveLoginStep("phone", res.data.tempToken, false, "");
      } else if (res.data?.requires2FA && res.data?.tempToken) {
        const setup = res.data.setupRequired || false;
        const qr = res.data.qrCode || "";
        setTempToken(res.data.tempToken);
        setSetupRequired(setup);
        setQrCode(qr);
        saveLoginStep("otp", res.data.tempToken, setup, qr);
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
    clearLoginStep();
    sessionStorage.setItem("token", token);
    sessionStorage.setItem("user", JSON.stringify(user));
    // Backup copy — something outside our code has been wiping sessionStorage
    // on refresh for this deployment. DashboardSwitcher restores from this
    // backup automatically if sessionStorage comes back empty.
    localStorage.setItem("token_backup", token);
    localStorage.setItem("user_backup", JSON.stringify(user));
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="emslogin__wrapper">
      <div className="emslogin__card-wrap">
        <div className="emslogin__card">

          <div className="emslogin__header">
            <div className="emslogin__logo" style={{ marginBottom: '28px', width: '96px', height: '96px', borderRadius: '18px', padding: '10px', boxSizing: 'border-box' }}>
              <img
                  src={import.meta.env.VITE_LOGO_URL || "/logo.jpg"}
                  alt="Logo"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  onError={(e) => {
                    if (e.target.src !== window.location.origin + "/logo.jpg") {
                      e.target.src = "/logo.jpg";
                    } else {
                      e.target.style.display = 'none';
                      e.target.parentNode.innerText = 'UTPL';
                    }
                  }}
                />
            </div>

            <h1 className="emslogin__title">WorkStockPro</h1>
          </div>

          {/* LOGIN */}
          {step === "login" && (
            <div className="emslogin__form">
              <form onSubmit={handleLogin} style={{ display: "contents" }}>
                <div className="emslogin__field">
                  <label htmlFor="username" className="emslogin__label">Employee ID</label>
                  <input
                    id="username"
                    name="username"
                    className="emslogin__input"
                    placeholder="UTPLS001"
                    required
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>

                <div className="emslogin__field">
                  <label htmlFor="password" className="emslogin__label">Password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      name="password"
                      className="emslogin__input"
                      placeholder="••••••••"
                      required
                      disabled={loading}
                      style={{ paddingRight: "44px" }}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="emslogin__eye-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      style={{
                        position: "absolute",
                        right: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "#64748b",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "36px",
                        height: "36px",
                        padding: "0",
                        zIndex: 2
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error && <div className="emslogin__error">{error}</div>}

                {sessionMsg && (
                  <div style={{
                    background: "#fef3c7", color: "#92400e",
                    border: "1px solid #fde68a", borderRadius: 8,
                    padding: "10px 14px", fontSize: 13, fontWeight: 600,
                    marginBottom: 14, display: "flex", alignItems: "center", gap: 8
                  }}>
                    {sessionMsg}
                  </div>
                )}

                <button className="emslogin__btn-primary" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>

              <button className="emslogin__btn-secondary" onClick={() => setStep("forgot")}>
                Forgot Password?
              </button>
            </div>
          )}


          {step === "phone" && (
            <div className="emslogin__form">
              <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <h2 className="emslogin__title" style={{ fontSize: "20px", marginBottom: "8px" }}>
                  Phone Verification
                </h2>
                <p style={{ fontSize: "14px", color: "var(--lg-muted)" }}>
                  Please enter your registered phone number to continue.
                </p>
              </div>
              <div className="emslogin__field" style={{ marginBottom: "24px" }}>
                <label htmlFor="phoneInput" className="emslogin__label">Phone Number</label>
                <input
                  id="phoneInput"
                  type="text"
                  className="emslogin__input"
                  placeholder="Enter phone number"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="tel"
                />
              </div>
              {error && <div className="emslogin__error" style={{ marginBottom: "20px" }}>{error}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <button
                  type="button"
                  className="emslogin__btn-primary"
                  disabled={loading || !phoneInput}
                  onClick={async () => {
                    try {
                      setLoading(true);
                      setError("");
                      const res = await authApi.post("/verify-phone", { tempToken, phone: phoneInput });
                      if (res.data?.requires2FA) {
                        const setup = res.data.setupRequired || false;
                        const qr = res.data.qrCode || "";
                        setTempToken(res.data.tempToken);
                        setSetupRequired(setup);
                        setQrCode(qr);
                        saveLoginStep("otp", res.data.tempToken, setup, qr);
                      }
                    } catch (err) {
                      setError(err.response?.data?.msg || "Phone verification failed");
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  {loading ? "Verifying..." : "Verify Phone"}
                </button>
                <button
                  type="button"
                  className="emslogin__btn-secondary"
                  onClick={() => { clearLoginStep(); setStep("login"); }}
                  disabled={loading}
                >
                  ← Back to Login
                </button>
              </div>
            </div>
          )}


          {step === "otp" && (
            <OtpVerification
              tempToken={tempToken}
              setupRequired={setupRequired}
              qrCode={qrCode}
              onBack={() => { clearLoginStep(); setStep("login"); }}
              onSuccess={finalizeLogin}
            />
          )}


          {step === "forgot" && (
            <div className="emslogin__form">
              <div className="emslogin__field">
                <label htmlFor="emailForgot" className="emslogin__label">Email Address</label>
                <input
                  id="emailForgot"
                  type="email"
                  className="emslogin__input"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
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

              <button className="emslogin__btn-secondary" onClick={() => { clearLoginStep(); setStep("login"); }}>
                Back to Login
              </button>
            </div>
          )}


          {step === "reset" && (
            <div className="emslogin__form">
              <div className="emslogin__field">
                <label htmlFor="resetOtp" className="emslogin__label">Verification Code</label>
                <input
                  id="resetOtp"
                  className="emslogin__input"
                  placeholder="6-digit code"
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value)}
                  autoComplete="one-time-code"
                />
              </div>
              <div className="emslogin__field">
                <label htmlFor="newPassword" className="emslogin__label">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  className="emslogin__input"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
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

              <button className="emslogin__btn-secondary" onClick={() => { clearLoginStep(); setStep("login"); }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
