import axios from "axios";

const envApi = import.meta.env.VITE_API_URL;
const originFallback = `${window.location.protocol}//${window.location.hostname}`;
export const API_URL = envApi || `${originFallback}/api`;
if (!envApi) console.warn(`[api] VITE_API_URL not set — using fallback ${API_URL}`);


export const authApi = axios.create({
  baseURL: `${API_URL}/auth`,
  headers: { "Content-Type": "application/json" },
});


export const api = axios.create({
  baseURL: `${API_URL}`,
  headers: { "Content-Type": "application/json" },
});


[api, authApi].forEach(instance => {
  instance.interceptors.request.use(config => {
    const token = sessionStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  // Global response error handler
  instance.interceptors.response.use(
    response => response,
    error => {
      // ── Ignore cancelled requests ──────────────────────────────────────
      // These happen when ProtectedRoute redirects before a request completes,
      // or when a component unmounts mid-flight. Not a real error — skip logging.
      if (axios.isCancel(error) || error.code === "ERR_CANCELED") {
        return Promise.reject(error);
      }

      const status = error.response?.status;
      const url = error.config?.url || "";

      if (status === 401) {
        console.warn(`[api] 401 Unauthorized on ${url}`);
        // Skip redirect for auth-check endpoints — DashboardSwitcher handles these itself
        const isAuthCheck =
          url.includes("/auth/me") ||
          url.includes("/permissions/my") ||
          url.includes("/meta/role-defaults") ||
          
          url.includes("/leave/my") ||
          url.includes("/notifications/my");
        if (!isAuthCheck) {
          sessionStorage.clear();
          if (!window.location.pathname.includes("/login")) {
            window.location.href = "/login";
          }
        }
      } else if (!error.response) {
        // Only log if it is a genuine network failure, not a browser cancellation
        console.warn(`[api] Network error on ${url} (backend may be restarting):`, error.message);
      } else {
        console.error(`[api] ${status} error on ${url}:`, error.response?.data);
      }

      return Promise.reject(error);
    }
  );
});