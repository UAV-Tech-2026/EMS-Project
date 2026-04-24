import { useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const AUTO_LOGOUT_TIME = 20 * 60 * 1000; // 20 minutes in milliseconds

const AutoLogout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const timerRef = useRef(null);

  const logout = useCallback(() => {
    console.log("Inactivity detected. Logging out...");
    localStorage.clear();
    // Use window.location.href to ensure a clean state, 
    // or navigate if you prefer SPA behavior.
    // navigate("/login", { replace: true });
    window.location.href = "/login";
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    // Only set timer if user is logged in
    if (localStorage.getItem("token")) {
      timerRef.current = setTimeout(logout, AUTO_LOGOUT_TIME);
    }
  }, [logout]);

  useEffect(() => {
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click"
    ];

    const handleActivity = () => resetTimer();

    // Set initial timer
    resetTimer();

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    // Cleanup
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [resetTimer, location.pathname]); // Reset on route change as well

  return children;
};

export default AutoLogout;
