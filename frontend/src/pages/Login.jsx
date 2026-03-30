import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { authApi } from "../utils/api";
import "../styles/Login.css";
import OtpVerification from "./OtpVerification";

export default function Login() {
  const navigate = useNavigate();

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

  // ✅ FIX 1: Prevent logged-in users from seeing login page
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      const user = JSON.parse(localStorage.getItem("user"));

      if (user?.role === "super_admin") {
        navigate("/super-admin-dashboard", { replace: true });
      } else if (user?.role === "admin") {
        navigate("/admin-dashboard", { replace: true });
      } else {
        navigate("/employee-dashboard", { replace: true });
      }
    }
  }, [navigate]);

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

  // ✅ FIX 2: Use replace:true to remove login from history
  const finalizeLogin = ({ token, user }) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));

    if (user.role === "super_admin")
      navigate("/super-admin-dashboard", { replace: true });
    else if (user.role === "admin")
      navigate("/admin-dashboard", { replace: true });
    else
      navigate("/employee-dashboard", { replace: true });
  };

  return (
    <div className="emslogin__wrapper">
      <div className="emslogin__card">

        {/* Header */}
        <div className="emslogin__header">
          <div className="emslogin__logo">EMS</div>
          <h1 className="emslogin__title">Welcome back</h1>
          <p className="emslogin__subtitle">Employee Management System</p>
        </div>

        {/* LOGIN */}
        {step === "login" && (
          <div className="emslogin__form">
            <form onSubmit={handleLogin} style={{ display: "contents" }}>
              <div className="emslogin__field">
                <label>Username</label>
                <input name="username" required disabled={loading} />
              </div>

              <div className="emslogin__field">
                <label>Password</label>
                <input type="password" name="password" required disabled={loading} />
              </div>

              {error && <div className="emslogin__error">{error}</div>}

              <button disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <button onClick={() => setStep("forgot")}>
              Forgot Password?
            </button>
          </div>
        )}

        {/* OTP */}
        {step === "otp" && (
          <OtpVerification
            tempToken={tempToken}
            setupRequired={setupRequired}
            qrCode={qrCode}
            onBack={() => setStep("login")}
          />
        )}

        {/* FORGOT PASSWORD */}
        {step === "forgot" && (
          <div className="emslogin__form">
            <input
              type="email"
              placeholder="Enter email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <button
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
              Send OTP
            </button>

            <button onClick={() => setStep("login")}>Back</button>
          </div>
        )}

        {/* RESET */}
        {step === "reset" && (
          <div className="emslogin__form">
            <input
              placeholder="OTP"
              value={resetOtp}
              onChange={(e) => setResetOtp(e.target.value)}
            />
            <input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <button
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
              Reset Password
            </button>

            <button onClick={() => setStep("login")}>Back</button>
          </div>
        )}
      </div>
    </div>
  );
}