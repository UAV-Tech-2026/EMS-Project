import { useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
const WARNING_MS = 2 * 60 * 1000;  // warn 2 min before

const ACTIVITY_EVENTS = [
  "mousemove", "mousedown", "keydown",
  "touchstart", "scroll", "click"
];

export default function AutoLogout({ children }) {
  const navigate   = useNavigate();
  const location   = useLocation();
  const timerRef   = useRef(null);
  const warnRef    = useRef(null);
  const toastRef   = useRef(null);

  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";

  const removeToast = () => {
    if (toastRef.current) {
      toastRef.current.remove();
      toastRef.current = null;
    }
  };

  const showWarningToast = useCallback(() => {
    removeToast();
    const toast = document.createElement("div");
    toast.id = "autologout-toast";
    toast.innerHTML = `
      <div style="
        position:fixed; bottom:24px; right:24px; z-index:99999;
        background:#1e293b; color:#fff; padding:16px 20px;
        border-radius:12px; font-family:'DM Sans',sans-serif;
        box-shadow:0 8px 32px rgba(0,0,0,0.3);
        display:flex; align-items:center; gap:12px;
        font-size:14px; font-weight:600; min-width:280px;
        border-left:4px solid #f59e0b;
        animation: slideIn 0.3s ease;
      ">
        <span style="font-size:20px;">⏱️</span>
        <div>
          <div style="margin-bottom:2px;">Session expiring soon</div>
          <div style="font-size:12px;font-weight:400;color:#94a3b8;">
            You'll be logged out in 2 minutes due to inactivity.
          </div>
        </div>
      </div>
      <style>
        @keyframes slideIn {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      </style>
    `;
    document.body.appendChild(toast);
    toastRef.current = toast;
  }, []);

  const doLogout = useCallback(() => {
    removeToast();
    localStorage.clear();
    navigate("/login", { replace: true, state: { reason: "inactivity" } });
  }, [navigate]);

  const resetTimers = useCallback(() => {
    // Don't run timer on auth pages
    if (isAuthPage) return;

    clearTimeout(timerRef.current);
    clearTimeout(warnRef.current);
    removeToast();

    // Only run if user is actually logged in
    if (!localStorage.getItem("token")) return;

    // Warning at 18 min
    warnRef.current = setTimeout(showWarningToast, TIMEOUT_MS - WARNING_MS);

    // Logout at 20 min
    timerRef.current = setTimeout(doLogout, TIMEOUT_MS);
  }, [isAuthPage, showWarningToast, doLogout]);

  // Attach activity listeners
  useEffect(() => {
    if (isAuthPage) {
      clearTimeout(timerRef.current);
      clearTimeout(warnRef.current);
      removeToast();
      return;
    }

    resetTimers();

    ACTIVITY_EVENTS.forEach(evt =>
      window.addEventListener(evt, resetTimers, { passive: true })
    );

    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(warnRef.current);
      ACTIVITY_EVENTS.forEach(evt =>
        window.removeEventListener(evt, resetTimers)
      );
    };
  }, [isAuthPage, resetTimers]);

  // Also reset when route changes (user is actively navigating)
  useEffect(() => {
    resetTimers();
  }, [location.pathname]);

  return children;
}
