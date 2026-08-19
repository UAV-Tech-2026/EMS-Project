import { useEffect, useState, useCallback, useRef } from "react";
import * as Router from "react-router-dom";
const { useNavigate } = Router;
import { api, API_URL } from "../utils/api";
import {
  BarChart3, LogOut, Calendar,
  Bell, ClipboardList, FileSpreadsheet,
  SquareCheck, LayoutDashboard,
  GitBranch, User, Settings as SettingsIcon,
  FileText, Plane,
  MessageSquare,
  ShieldAlert, Package, FolderOpen
} from "lucide-react";
import ApplyLeave from "./ApplyLeave";
import MeetingCalendar from "./MeetingCalendar";
import EmployeeRequestForm from "../components/EmployeeRequestForm";
import Documents from "./Documents";
import DPRCard from "./DPRCard";

import "../styles/EmployeeDashboard.css";

const STATUS_META = {
  done: { color: "#10b981", label: "Completed" },
  overdue: { color: "#ef4444", label: "Overdue" },
  soon: { color: "#f59e0b", label: "Due Soon" },
  pending: { color: "#3b82f6", label: "Pending" }
};

export default function EmployeeDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [profilePic, setProfilePic] = useState(null);
 const [activeView, setActiveView] = useState(
  () => window.location.hash.replace("#", "") || "dashboard"
);
const changeView = (view) => {
  window.location.hash = view === "dashboard" ? "" : view;
  setActiveView(view);
};

  const [presentCount, setPresentCount] = useState(0);
  const [absentCount, setAbsentCount] = useState(0);
  const [leaveCount, setLeaveCount] = useState(0);

  const [activity, setActivity] = useState([]);
  const [eodTasks, setEodTasks] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [bulletins, setBulletins] = useState([]);

  const [statsLoading, setStatsLoading] = useState(true);
  const [eodLoading, setEodLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);

  // WorkStock Pro
  const [stockProducts, setStockProducts]     = useState([]);
  const [stockLoading, setStockLoading]       = useState(false);
  const [stockAction, setStockAction]         = useState("withdraw"); // "withdraw" | "return"
  const [selectedProduct, setSelectedProduct] = useState("");
  const [stockQty, setStockQty]               = useState(1);
  const [stockMsg, setStockMsg]               = useState({ type: "", text: "" });
  const [stockSubmitting, setStockSubmitting] = useState(false);
  const [myTransactions, setMyTransactions]   = useState([]);
  const [stockError, setStockError]           = useState("");
  const [showWorkStock, setShowWorkStock]     = useState(false);
  const [showDPR, setShowDPR]               = useState(false);
  const [activityLoading, setActivityLoading] = useState(true);
  const [bulletsLoading, setBulletsLoading] = useState(true);

  // Reset WorkStock view when navigating away from the dashboard view
  // This prevents the inline WorkStock card from persisting and causing layout shifts
  // when the user opens other sections (e.g., Apply Leave, Meetings, Request).
  useEffect(() => {
    if (activeView !== "dashboard") {
      setShowWorkStock(false);
      setShowDPR(false);
    }
  }, [activeView]);
 
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(true);
  const notifRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;


  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      setNotifLoading(false);
      return;
    }
    const fetchNotifications = async () => {
      try {
        const res = await api.get("/notifications/my");
        setNotifications(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        if (err.response?.status === 401) {
          // Let api.js global interceptor handle redirect — just stop here
          return;
        }
        console.error("Failed to fetch notifications:", err);
        setNotifications([]);
      } finally {
        setNotifLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await api.post("/notifications/mark-read");
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Failed to mark notifications as read:", err);
    }
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem("user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        let pic = parsed.profilePic || parsed.profile_pic;
        if (pic) {
          if (pic.startsWith("/uploads")) {
            pic = `${API_URL}${pic}`;
          }
          setProfilePic(pic);
        }
      } catch {
        sessionStorage.clear();
        navigate("/login");
      }
    } else {
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get("/attendance/stats/my");
        setPresentCount(res.data.presentCount ?? 0);
        setAbsentCount(res.data.absentCount ?? 0);
        setLeaveCount(res.data.leaveCount ?? 0);
      } catch (err) {
        console.error("Failed to fetch attendance stats:", err);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    const fetchEodTasks = async () => {
      try {
        const res = await api.get("/dpr/eod-tasks");
        setEodTasks(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to fetch EOD tasks:", err);
        setEodTasks([]);
      } finally {
        setEodLoading(false);
      }
    };
    fetchEodTasks();
  }, []);

  useEffect(() => {
    const fetchMyTasks = async () => {
      try {
        const res = await api.get("/tasks/list");
        const stored = sessionStorage.getItem("user");
        if (stored) {
          const parsed = JSON.parse(stored);

          
          const myUserId = parsed.id;
          const filtered = (res.data || []).filter(
            t => String(t.assigned_to) === String(myUserId)
          );
          setMyTasks(filtered);
        }
      } catch (err) {
        console.error("Failed to fetch tasks:", err);
        setMyTasks([]);
      } finally {
        setTasksLoading(false);
      }
    };
    fetchMyTasks();
  }, []);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await api.get("/employees/my-activity");
        setActivity(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to fetch activity:", err);
        setActivity([]);
      } finally {
        setActivityLoading(false);
      }
    };
    fetchActivity();
  }, []);

  useEffect(() => {
    const fetchBulletins = async () => {
      try {
        const res = await api.get("/bulletins");
        setBulletins(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to fetch bulletins:", err);
        setBulletins([]);
      } finally {
        setBulletsLoading(false);
      }
    };
    fetchBulletins();
  }, []);

const handleLogout = useCallback(() => {
  sessionStorage.clear();
  sessionStorage.removeItem("emp_active_view");
  navigate("/login", { replace: true });
}, [navigate]);

  const initials = (name = "") =>
    name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const isLead = user?.designation?.toLowerCase().includes("lead");

  const parseDeadline = (deadlineStr) => {
    if (!deadlineStr) return null;
    return deadlineStr.length === 10
      ? new Date(deadlineStr + "T00:00:00")
      : new Date(deadlineStr);
  };

  const getEodCardStatus = (task) => {
    const deadline = parseDeadline(task.deadline);
    const now = new Date();
    if (task.status === "done" || task.status === "Completed") return "done";
    if (deadline && now > deadline) return "overdue";
    if (deadline && deadline - now < 2 * 60 * 60 * 1000) return "soon";
    return "pending";
  };

  const logoUrl = import.meta.env.VITE_LOGO_URL || "/logo.jpg";

const STOCK_BASE = import.meta.env.VITE_WORKSTOCK_API_URL
  || (import.meta.env.VITE_WORKSTOCK_URL ? import.meta.env.VITE_WORKSTOCK_URL.replace(":3001", ":5001") : null)
  || null;

  const stockFetch = async (path, options = {}) => {
    if (!STOCK_BASE) {
      throw new Error("WorkStock API URL not configured (set VITE_WORKSTOCK_API_URL)");
    }
    const token = sessionStorage.getItem("token");
    try {
      const res = await fetch(`${STOCK_BASE}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      return res.json();
    } catch (err) {
      // Normalize network errors so callers can handle them gracefully
      throw new Error(`WorkStock fetch failed: ${err.message || err}`);
    }
  };

  const fetchStockProducts = async () => {
    setStockLoading(true);
    setStockError("");
    try {
      const data = await stockFetch("/api/products");
      setStockProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Stock fetch error:", err);
      setStockProducts([]);
      setStockError(err.message || "Failed to load stock products.");
    } finally { setStockLoading(false); }
  };

  const fetchMyTransactions = async () => {
    setStockError("");
    try {
      const data = await stockFetch("/api/my-transactions");
      setMyTransactions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Transactions fetch error:", err);
      setMyTransactions([]);
      setStockError(err.message || "Failed to load your stock transactions.");
    }
  };

  useEffect(() => {
    if (showWorkStock) {
      fetchStockProducts();
      fetchMyTransactions();
    }
  }, [showWorkStock]);

  const handleStockSubmit = async () => {
    if (!selectedProduct || !stockQty || stockQty < 1) return;
    setStockSubmitting(true);
    setStockMsg({ type: "", text: "" });
    try {
      const endpoint = stockAction === "withdraw" ? "/api/stock-out" : "/api/return";
      await stockFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: parseInt(selectedProduct, 10), quantity: Number(stockQty) }),
      });
      setStockMsg({ type: "success", text: `✓ ${stockAction === "withdraw" ? "Withdrawn" : "Returned"} successfully!` });
      setSelectedProduct(""); setStockQty(1);
      fetchStockProducts();
      fetchMyTransactions();
    } catch (err) {
      setStockMsg({ type: "error", text: err.message || "Action failed." });
    } finally { setStockSubmitting(false); }
  };

  return (
    <>
    <div className="emp-shell">
      {/* ── SIDEBAR ── */}
      <aside className="emp-sidebar">
        <div className="emp-logo-area">
          <div className="emp-logo-mark">
            <div style={{
              width: 58, height: 58,
              background: "#ffffff",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden"
            }}>
              <img
                src={import.meta.env.VITE_LOGO_URL || "/logo.jpg"}
                alt="Logo"
                style={{ width: 50, height: 50, objectFit: "contain" }}
                onError={(e) => {
                  if (e.target.src !== window.location.origin + "/logo.jpg") {
                    e.target.src = "/logo.jpg";
                  } else {
                    e.target.style.display = 'none';
                  }
                }}
              />
            </div>
            <div>
              <div className="emp-logo-text">WorkStockPro</div>
              <div className="emp-logo-sub">Employee Portal</div>
            </div>
          </div>
        </div>

        <nav className="emp-nav">
          <div className="emp-nav-label">MAIN</div>
          <div
            className={`emp-nav-item ${activeView === "dashboard" ? "emp-nav-active" : ""}`}
            onClick={() => setActiveView("dashboard")}
          >
            <LayoutDashboard size={18} /> Dashboard
          </div>

          <div className="emp-nav-label">TOOLS</div>

          <div
            className={`emp-nav-item ${showWorkStock ? "emp-nav-active" : ""}`}
            onClick={() => { setActiveView("dashboard"); setShowWorkStock(true); }}
          >
            <Package size={18} /> WorkStock Pro
          </div>

          <div className="emp-nav-item" onClick={() => navigate("/task-management")}>
            <GitBranch size={18} /> {isLead ? "Team Tasks" : "My Tasks"}
          </div>

          <div className="emp-nav-item" onClick={() => navigate("/settings")}>
            <SettingsIcon size={18} /> Settings
          </div>
        </nav>

        <div className="emp-sidebar-footer">
          <button className="emp-logout-btn" onClick={handleLogout}>
            <LogOut size={15} /> Logout
          </button>
        </div>
      </aside>

      
      <div className="emp-main">
      
        <div className="emp-topbar">
          <div>
            <div className="emp-page-sub">
              Welcome  <strong>{user?.fullname || "Employee"}</strong>
            </div>
          </div>
          <div className="emp-topbar-right">
            <div className="emp-date-chip">
              {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </div>

           
            <div className="emp-notif-wrapper" ref={notifRef}>
              <button
                className="emp-notif-bell"
                onClick={() => setNotifOpen(prev => !prev)}
                aria-label="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="emp-notif-badge">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="emp-notif-dropdown">
                  <div className="emp-notif-header">
                    <span className="emp-notif-title">
                      Notifications
                      {unreadCount > 0 && (
                        <span className="emp-notif-count-pill">{unreadCount} new</span>
                      )}
                    </span>
                    {unreadCount > 0 && (
                      <button className="emp-notif-mark-read" onClick={handleMarkAllRead}>
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="emp-notif-list">
                    {notifLoading ? (
                      <div className="emp-notif-empty">Loading…</div>
                    ) : notifications.length === 0 ? (
                      <div className="emp-notif-empty">
                        <span className="emp-notif-empty-icon">🎉</span>

                        <div style={{ fontSize: "11px", marginTop: "4px" }}>No new notifications</div>
                      </div>
                    ) : (
                      notifications.map((n, i) => (
                        <div
                          key={n.id ?? i}
                          className={`emp-notif-item ${!n.is_read ? "emp-notif-unread" : ""}`}
                        >
                          {!n.is_read && <span className="emp-notif-dot" />}
                          <div className="emp-notif-body">
                            <div className="emp-notif-message">{n.message}</div>
                            {n.created_at && (
                              <div className="emp-notif-time">
                                {new Date(n.created_at).toLocaleString("en-IN", {
                                  day: "numeric", month: "short",
                                  hour: "2-digit", minute: "2-digit"
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="emp-avatar-pill" onClick={() => navigate("/settings")}>
              {profilePic ? (
                <img src={profilePic} alt="Avatar" className="emp-avatar-img" />
              ) : (
                <div className="emp-avatar-initials">{initials(user?.fullname)}</div>
              )}
              <span className="emp-avatar-name">{user?.designation?.toUpperCase() || "EMPLOYEE"}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="emp-content">
          {activeView === "apply-leave" ? (
            <div style={{ padding: "10px 0" }}>
              <button onClick={() => setActiveView("dashboard")} style={{ marginBottom: 16, padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>← Back to Dashboard</button>
              <ApplyLeave inline onClose={() => setActiveView("dashboard")} />
            </div>
          ) : activeView === "meetings" ? (
            <div style={{ padding: "10px 0" }}>
              <button onClick={() => setActiveView("dashboard")} style={{ marginBottom: 16, padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>← Back to Dashboard</button>
              <MeetingCalendar onClose={() => setActiveView("dashboard")} />
            </div>
          ) : activeView === "request" ? (
            <div style={{ padding: "10px 0" }}>
              <button onClick={() => setActiveView("dashboard")} style={{ marginBottom: 16, padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>← Back to Dashboard</button>
              <EmployeeRequestForm />
            </div>
          ) : activeView === "documents" ? (
            <div style={{ padding: "10px 0" }}>
              <button onClick={() => setActiveView("dashboard")} style={{ marginBottom: 16, padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>← Back to Dashboard</button>
              <Documents />
            </div>
          ) : (
            <>
              {/* ── KPI Stat Cards ── */}
              <div className="emp-stats-row">
                <div className="emp-stat-card emp-stat-teal">
                  <span className="emp-stat-badge">Days</span>
                  <div className="emp-stat-icon"><SquareCheck size={20} /></div>
                  <div className="emp-stat-number">{statsLoading ? "…" : presentCount}</div>
                  <div className="emp-stat-label">Present Days</div>
                </div>

                <div className="emp-stat-card emp-stat-blue">
                  <span className="emp-stat-badge">Days</span>
                  <div className="emp-stat-icon"><BarChart3 size={20} /></div>
                  <div className="emp-stat-number" style={{ color: "#ef4444" }}>
                    {statsLoading ? "…" : absentCount}
                  </div>
                  <div className="emp-stat-label">Absent</div>
                </div>

                <div className="emp-stat-card emp-stat-green">
                  <span className="emp-stat-badge">Live</span>
                  <div className="emp-stat-icon"><Plane size={20} /></div>
                  <div className="emp-stat-number">{statsLoading ? "…" : leaveCount}</div>
                  <div className="emp-stat-label">Leaves Taken</div>
                </div>

                <div className="emp-stat-card emp-stat-purple">
                  <span className="emp-stat-badge">Today</span>
                  <div className="emp-stat-icon"><BarChart3 size={20} /></div>

                  <div className="emp-stat-label">Efficiency</div>
                </div>
              </div>

              {/* ── Quick Actions ── */}
              <div className="emp-section-header">
                <span className="emp-section-title">QUICK ACTIONS</span>
              </div>
              <div className="emp-actions-grid">
                <EmpActionCard
                  icon={<Plane size={20} />}
                  name="Apply Leave"
                  desc="Submit leave request"
                  accent="orange"
                  onClick={() => setActiveView("apply-leave")}
                />
                <EmpActionCard
                  icon={<Calendar size={20} />}
                  name="View Attendance"
                  desc="Check your records"
                  accent="blue"
                  onClick={() => navigate("/attendance")}
                />
                <EmpActionCard
                  icon={<FileText size={20} />}
                  name="Payslips"
                  desc="View & Request"
                  accent="teal"
                  onClick={() => navigate("/payslips")}
                />
                <EmpActionCard
                  icon={<Calendar size={20} />}
                  name="Meetings"
                  desc="Join Scheduled Calls"
                  accent="purple"
                  onClick={() => setActiveView("meetings")}
                />
                <EmpActionCard
                  icon={<Package size={20} />}
                  name="WorkStock Pro"
                  desc="Withdraw or Return stock"
                  accent="indigo"
                  onClick={() => setShowWorkStock(!showWorkStock)}
                />
                <EmpActionCard
                  icon={<MessageSquare size={20} />}
                  name="Document Request"
                  desc="Request certificates & docs"
                  accent="teal"
                  onClick={() => setActiveView("request")}
                />
                <EmpActionCard
                  icon={<FolderOpen size={20} />}
                  name="Documents"
                  desc="View your files & docs"
                  accent="blue"
                  onClick={() => setActiveView("documents")}
                />
                {/* DPR trigger card — matches other action cards */}
                <button
                  type="button"
                  className="emp-action-card emp-action-indigo"
                  onClick={() => setShowDPR(prev => !prev)}
                  style={{ textAlign: "left" }}
                >
                  <div className="emp-action-icon"><ClipboardList size={20} /></div>
                  <div>
                    <div className="emp-action-name">Daily Progress Report</div>
                    <div className="emp-action-desc">Fill &amp; save without downloading</div>
                  </div>
                  <div style={{
                    marginLeft: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    flexShrink: 0,
                  }}>
                    <span style={{
                      background: showDPR ? "#e0e7ff" : "#f1f5f9",
                      color: showDPR ? "#4f46e5" : "#64748b",
                      fontSize: 10, fontWeight: 700,
                      padding: "3px 8px", borderRadius: 8,
                      whiteSpace: "nowrap",
                    }}>
                      {showDPR ? "▲ Close" : "▼ Fill DPR"}
                    </span>
                  </div>
                </button>
              </div>

              {/* ── DPR Inline Panel ── */}
              {showDPR && (
                <div style={{
                  marginTop: 12,
                  background: "#fff",
                  border: "1px solid #e0e7ff",
                  borderRadius: 14,
                  boxShadow: "0 4px 20px rgba(99,102,241,0.08)",
                  overflow: "hidden",
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 18px",
                    borderBottom: "1px solid #e0e7ff",
                    background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
                  }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#4f46e5" }}>
                      📋 Daily Progress Report
                    </span>
                    <button
                      onClick={() => setShowDPR(false)}
                      style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", fontSize: 18, lineHeight: 1 }}
                    >✕</button>
                  </div>
                  <div style={{ padding: "16px 18px" }}>
                    <DPRCard inline onClose={() => setShowDPR(false)} />
                  </div>
                </div>
              )}

              {/* ── WorkStock Pro Inline Card ── */}
              {showWorkStock && (
                <WorkStockCard
                  user={user}
                  myTransactions={myTransactions}
                  stockProducts={stockProducts}
                  stockLoading={stockLoading}
                  stockError={stockError}
                  stockAction={stockAction}
                  setStockAction={setStockAction}
                  selectedProduct={selectedProduct}
                  setSelectedProduct={setSelectedProduct}
                  stockQty={stockQty}
                  setStockQty={setStockQty}
                  stockMsg={stockMsg}
                  setStockMsg={setStockMsg}
                  stockSubmitting={stockSubmitting}
                  handleStockSubmit={handleStockSubmit}
                  onOpen={() => { fetchStockProducts(); fetchMyTransactions(); }}
                />
              )}

              {/* ── Recent Activity ── */}
              <div className="emp-section-header" style={{ marginTop: "24px" }}>
                <span className="emp-section-title">RECENT ACTIVITY</span>
              </div>
              <div className="emp-bottom-row">
                {/* EOD Task List */}
                <div className="emp-bottom-card">
                  <div className="emp-card-title">📋 Today's EOD Tasks</div>
                  {eodLoading ? (
                    <div className="emp-empty-state">Loading tasks…</div>
                  ) : eodTasks.length === 0 ? (
                    <div className="emp-empty-state">No tasks for today.</div>
                  ) : (
                    <div className="emp-activity-list">
                      {eodTasks.map((task, i) => {
                        const status = getEodCardStatus(task);
                        const meta = STATUS_META[status];
                        return (
                          <div key={i} className="emp-activity-item">
                            <div className="emp-activity-dot" style={{ background: meta.color }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <div className="emp-activity-text">{task.title}</div>
                                <span style={{ fontSize: "10px", color: meta.color, fontWeight: "bold" }}>
                                  {meta.label}
                                </span>
                              </div>
                              <div className="emp-activity-sub">{task.description}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Activity Feed */}
                <div className="emp-bottom-card">
                  <div className="emp-card-title">Recent Activity</div>
                  <div className="emp-activity-list">
                    {activityLoading ? (
                      <div className="emp-empty-state">Loading activity…</div>
                    ) : activity.length === 0 ? (
                      <div className="emp-empty-state">No recent activity.</div>
                    ) : (
                      activity.map((item, index) => (
                        <div key={index} className="emp-activity-item">
                          <div className="emp-activity-dot" style={{ background: "#4f46e5" }} />
                          <div className="emp-activity-text">{item}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Bulletins Section (New Feature) */}
                <div className="emp-bottom-card">
                  <div className="emp-card-title"> Latest Bulletins</div>
                  <div className="emp-activity-list">
                    {bulletsLoading ? (
                      <div className="emp-empty-state">Loading bulletins…</div>
                    ) : bulletins.length === 0 ? (
                      <div className="emp-empty-state">No news at this time.</div>
                    ) : (
                      bulletins.map((bullet, i) => (
                        <div key={bullet.id || i} className="emp-activity-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px", padding: i === 0 ? "0 0 12px 0" : "12px 0", borderBottom: i === bulletins.length - 1 ? "none" : "1px solid #f1f5f9" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
                            <div className="emp-activity-dot" style={{ background: "#10b981", flexShrink: 0 }} />
                            <div className="emp-activity-text" style={{ fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>{i + 1}. {bullet.title}</div>
                          </div>
                          <div className="emp-activity-sub" style={{ marginLeft: "18px", color: "#64748b", lineHeight: "1.4" }}>{bullet.content}</div>
                          <div style={{ marginLeft: "18px", fontSize: "10px", color: "#94a3b8", marginTop: "4px" }}>
                            Posted: {new Date(bullet.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* ── My Task Load ── */}
              <div className="emp-section-header" style={{ marginTop: "24px" }}>
                <span className="emp-section-title"> MY TASK LOAD</span>
                <button className="emp-view-all-btn" onClick={() => navigate("/task-management")}>
                  View All
                </button>
              </div>
              <div className="emp-bottom-card" style={{ padding: "10px" }}>
                <table className="emp-task-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Hours</th>
                      <th>Due Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasksLoading ? (
                      <tr><td colSpan="4" className="emp-empty-state">Loading…</td></tr>
                    ) : myTasks.length === 0 ? (
                      <tr><td colSpan="4" className="emp-empty-state">No active tasks.</td></tr>
                    ) : (
                      myTasks.map(task => (
                        <tr key={task.id}>
                          <td className="emp-task-title">{task.title}</td>
                          <td>{task.man_hours ?? "—"}</td>
                          <td>{task.due_date ? new Date(task.due_date.split("T")[0] + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                          <td>
                            <span
                              className="emp-task-status"
                              style={{
                                background: task.status === "Completed"
                                  ? "rgba(16,185,129,0.1)"
                                  : "rgba(245,158,11,0.1)",
                                color: task.status === "Completed" ? "#10b981" : "#f59e0b"
                              }}
                            >
                              {task.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
      {/* WorkStock modal removed — now inline card */}
    </>
  );
}

function EmpActionCard({ icon, name, desc, accent, onClick }) {
  return (
    <button
      type="button"
      className={`emp-action-card emp-action-${accent}`}
      onClick={(e) => { e.preventDefault(); if (typeof onClick === 'function') onClick(); }}
    >
      <div className="emp-action-icon">{icon}</div>
      <div>
        <div className="emp-action-name">{name}</div>
        <div className="emp-action-desc">{desc}</div>
      </div>
    </button>
  );
}

function WorkStockCard({
  user, myTransactions, stockProducts, stockLoading, stockError,
  stockAction, setStockAction,
  selectedProduct, setSelectedProduct,
  stockQty, setStockQty,
  stockMsg, setStockMsg,
  stockSubmitting, handleStockSubmit, onOpen,
}) {
  const [loaded, setLoaded] = useState(false);
  const [txTab, setTxTab] = useState("withdrawals"); // "withdrawals" | "deposits"
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const initials = (name = "") => name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  // load on first render
  useEffect(() => {
    if (!loaded) { onOpen(); setLoaded(true); }
  }, []);

  const withdrawals = myTransactions.filter(t => t.type === "OUT");
  const deposits    = myTransactions.filter(t => t.type === "IN");
  const totalOrders = myTransactions.length;
  const rawUnits    = myTransactions.reduce((s, t) => {
    const qty = t.quantity || 0;
    if (t.type === "OUT") return s + qty;
    if (t.type === "IN" || t.type === "RETURN") return s - qty;
    return s;
  }, 0);
  const totalUnits  = Math.max(0, rawUnits);
  const hasOverReturn = rawUnits < 0;
  const totalValue  = myTransactions.reduce((s, t) => s + (t.total_value || t.value || 0), 0);

  const displayed = (txTab === "withdrawals" ? withdrawals : deposits)
    .filter(t => {
      const name = (t.item_name || t.product_name || "").toLowerCase();
      return name.includes(search.toLowerCase());
    });

  return (
    <div style={{
      marginTop: 24,
      background: "#ffffff",
      borderRadius: "16px",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)",
      border: "1px solid #e2e8f0",
      overflow: "hidden",
      transition: "all 0.3s ease"
    }}>
      {/* ── Premium Light header banner ── */}
      <div style={{
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
        borderBottom: "1px solid #e2e8f0",
        borderTop: "4px solid #6366f1",
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
      }}>
        {/* Left: avatar + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "#eef2ff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 800, color: "#6366f1",
            border: "2px solid #c7d2fe",
            flexShrink: 0,
          }}>
            {initials(user?.fullname || "E")}
          </div>
          <div>
            <div style={{ color: "#1e293b", fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>
              {user?.fullname || "Employee"}
            </div>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 4, fontWeight: 500 }}>
              — {user?.designation || "Staff Member"}
            </div>
          </div>
        </div>

        {/* Right: stats chips */}
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "ORDERS", value: totalOrders },
            { label: "UNITS",  value: totalUnits, warn: totalUnits === 0 && myTransactions.length > 0 },
            { label: "VALUE",  value: `INR ${totalValue}` },
          ].map(s => (
            <div key={s.label} style={{
              background: s.warn ? "#fffbeb" : "#f1f5f9",
              border: `1px solid ${s.warn ? "#fde68a" : "#e2e8f0"}`,
              borderRadius: 12,
              padding: "10px 18px",
              textAlign: "center",
              minWidth: 72,
              position: "relative",
            }}>
              <div style={{ color: s.warn ? "#d97706" : "#6366f1", fontWeight: 800, fontSize: 20, lineHeight: 1 }}>
                {s.warn ? "⚠ 0" : s.value}
              </div>
              <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, marginTop: 4, letterSpacing: 0.8 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Action buttons row ── */}
      <div style={{
        background: "#fff",
        padding: "16px 24px",
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
      }}>

        <button
          onClick={() => { setShowForm(true); setStockAction("withdraw"); setStockMsg({ type: "", text: "" }); }}
          style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 18px", borderRadius:10, border:"none", background:"#2563eb", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>
          ↓ Withdraw Item
        </button>
        <button
          onClick={() => { setShowForm(true); setStockAction("return"); setStockMsg({ type: "", text: "" }); }}
          style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 18px", borderRadius:10, border:"none", background:"#ea580c", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>
          ↺ Return Item
        </button>
      </div>

      {/* ── Inline form (shown when action button clicked) ── */}
      {showForm && (
        <div style={{
          background: "#f8fafc",
          borderTop: "1px solid #f1f5f9",
          padding: "16px 24px",
        }}>
          {stockError && (
            <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: "#fef2f2",
              color: "#991b1b",
              border: "1px solid #fecaca" }}>
              {stockError}
            </div>
          )}
          {stockMsg.text && (
            <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: stockMsg.type === "success" ? "#dcfce7" : "#fee2e2",
              color: stockMsg.type === "success" ? "#166534" : "#991b1b",
              border: `1px solid ${stockMsg.type === "success" ? "#bbf7d0" : "#fecaca"}` }}>
              {stockMsg.text}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px auto", gap: 10, alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                {stockAction === "withdraw" ? "Withdraw" : "Return"} Product
              </label>
              {stockLoading ? (
                <div style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, color: "#94a3b8", background: "#fff" }}>Loading…</div>
              ) : (
                <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}>
                  <option value="">— Choose Product —</option>
                  {stockAction === "return" ? (() => {
                    const withdrawnProducts = {};
                    myTransactions.forEach(t => {
                      const pid = t.product_id;
                      if (!withdrawnProducts[pid]) {
                        withdrawnProducts[pid] = {
                          id: pid,
                          item_name: t.item_name || t.product_name || "Unknown",
                          net_out: 0
                        };
                      }
                      if (t.type === "OUT") withdrawnProducts[pid].net_out += (t.quantity || 0);
                      if (t.type === "RETURN") withdrawnProducts[pid].net_out -= (t.quantity || 0);
                    });
                    const returnable = Object.values(withdrawnProducts).filter(p => p.net_out > 0);
                    if (returnable.length === 0) {
                      return <option disabled>No items to return</option>;
                    }
                    return returnable.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.item_name} — {p.net_out} outstanding
                      </option>
                    ));
                  })() : (
                    stockProducts.map(p => (
                      <option key={p.id} value={p.id} disabled={p.quantity === 0}>
                        {p.item_name} — {p.quantity} in stock {p.quantity === 0 ? "(Out)" : p.quantity < (p.min_stock || 5) ? "⚠️" : ""}
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Qty</label>
              {(() => {
                let maxQty = undefined;
                if (stockAction === "return" && selectedProduct) {
                  let netOut = 0;
                  myTransactions.forEach(t => {
                    if (String(t.product_id) === String(selectedProduct)) {
                      if (t.type === "OUT") netOut += (t.quantity || 0);
                      if (t.type === "RETURN") netOut -= (t.quantity || 0);
                    }
                  });
                  maxQty = netOut > 0 ? netOut : 0;
                } else if (stockAction === "withdraw" && selectedProduct) {
                   const p = stockProducts.find(p => String(p.id) === String(selectedProduct));
                   maxQty = p ? p.quantity : undefined;
                }

                return (
                  <input type="number" min={1} max={maxQty} value={stockQty} onChange={e => {
                    let v = parseInt(e.target.value, 10);
                    if (maxQty !== undefined && v > maxQty) v = maxQty;
                    setStockQty(isNaN(v) ? "" : v);
                  }}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }} />
                );
              })()}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleStockSubmit} disabled={stockSubmitting || !selectedProduct}
                style={{ padding: "10px 18px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  background: stockAction === "withdraw" ? "#2563eb" : "#ea580c", color: "#fff",
                  opacity: (stockSubmitting || !selectedProduct) ? 0.5 : 1 }}>
                {stockSubmitting ? "…" : stockAction === "withdraw" ? "Confirm" : "Confirm"}
              </button>
              <button onClick={() => { setShowForm(false); setStockMsg({ type: "", text: "" }); }}
                style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs + Search ── */}
      <div style={{
        background: "#fff",
        borderTop: "1px solid #f1f5f9",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 4 }}>
          {[
            { key: "withdrawals", label: `Withdrawals (${withdrawals.length})` },
            { key: "deposits",    label: `Deposits (${deposits.length})` },
          ].map(tab => (
            <button key={tab.key} onClick={() => setTxTab(tab.key)}
              style={{ padding: "8px 16px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer",
                background: txTab === tab.key ? "#fff" : "transparent",
                color: txTab === tab.key ? "#1e293b" : "#64748b",
                boxShadow: txTab === tab.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
              {tab.label}
            </button>
          ))}
        </div>
        <input
          placeholder="Search items..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, width: 200, outline: "none" }}
        />
      </div>

      {/* ── Transaction list ── */}
      <div style={{
        background: "#fff",
        borderRadius: "0 0 16px 16px",
        padding: "8px 24px 20px",
        minHeight: 80,
      }}>
        {displayed.length === 0 ? (
          <div style={{ padding: "24px 0", color: "#94a3b8", fontSize: 13 }}>No records found.</div>
        ) : (
          displayed.slice(0, 8).map((t, i) => (
            <div key={t.id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 0", borderBottom: i < displayed.length - 1 ? "1px solid #f1f5f9" : "none", fontSize: 13 }}>
              <div>
                <span style={{ fontWeight: 600, color: "#1e293b" }}>{t.item_name || t.product_name || "Product"}</span>
                <span style={{ marginLeft: 8, fontSize: 11, color: "#94a3b8" }}>
                  {new Date(t.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, color: "#1e293b" }}>×{t.quantity}</span>
                <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                  background: t.type === "OUT" ? "#fee2e2" : "#dcfce7",
                  color: t.type === "OUT" ? "#991b1b" : "#166534" }}>
                  {t.type === "OUT" ? "Withdrawn" : "Returned"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}