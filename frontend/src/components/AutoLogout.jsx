



import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const AUTO_LOGOUT_TIME = 10 * 60 * 1000;

const AutoLogout = ({ children }) => {
  const navigate = useNavigate();
  const timerRef = useRef(null);

  const logout = useCallback(() => {
    sessionStorage.clear();
    localStorage.removeItem("token_backup");
    localStorage.removeItem("user_backup");
    navigate("/login", { replace: true, state: { reason: "inactivity" } });
  }, [navigate]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (sessionStorage.getItem("token")) {
      timerRef.current = setTimeout(logout, AUTO_LOGOUT_TIME);
    }
  }, [logout]);

  useEffect(() => {
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];
    const handleActivity = () => resetTimer();
    resetTimer();
    events.forEach(e => window.addEventListener(e, handleActivity));

    
    const handlePageShow = (e) => {
      if (e.persisted) {
        sessionStorage.clear();
        localStorage.removeItem("token_backup");
        localStorage.removeItem("user_backup");
        window.location.replace("/login");
      }
    };

    window.addEventListener("pageshow", handlePageShow);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(e => window.removeEventListener(e, handleActivity));
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [resetTimer]);

  return children;
};

export default AutoLogout;