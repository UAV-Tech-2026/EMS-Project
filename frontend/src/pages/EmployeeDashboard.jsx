import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import {
  BarChart3, LogOut, Calendar,
  Bell, ClipboardList, FileSpreadsheet,
  SquareCheck, LayoutDashboard,
  GitBranch, User, Settings as SettingsIcon,
  FileText, Plane,
  MessageSquare,
  ShieldAlert
} from "lucide-react";
import EmployeeRequestForm from "../components/EmployeeRequestForm";
import MeetingCalendar from "./MeetingCalendar";

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
  const [activeView, setActiveView] = useState("dashboard");

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
  const [activityLoading, setActivityLoading] = useState(true);
  const [bulletsLoading, setBulletsLoading] = useState(true);

  // ── Notifications state ──
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(true);
  const notifRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // ── Close dropdown on outside click ──
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Fetch notifications ──
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await api.get("/notifications/my");
        setNotifications(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
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
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        if (parsed.profilePic) setProfilePic(parsed.profilePic);
      } catch {
        localStorage.clear();
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
        const stored = localStorage.getItem("user");
        if (stored) {
          const parsed = JSON.parse(stored);

          // ✅ FIX: Match by user ID (reliable) instead of name string comparison.
          // Name matching is fragile (case, spaces) and misses nested work items.
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
    localStorage.clear();
    navigate("/login");
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

  return (
    <div className="emp-shell">
      {/* ── SIDEBAR ── */}
      <aside className="emp-sidebar">
        <div className="emp-logo-area">
          <div className="emp-logo-mark">
            <div style={{
              width: 38, height: 38,
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
                style={{ width: 34, height: 34, objectFit: "contain" }}
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
              <div className="emp-logo-text">UAV TECH</div>
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

          <div
            className={`emp-nav-item ${activeView === "requests" ? "emp-nav-active" : ""}`}
            onClick={() => setActiveView("requests")}
          >
            <MessageSquare size={18} /> Requests
          </div>

          <div className="emp-nav-label">TOOLS</div>

          {isLead && (
            <div className="emp-nav-item" onClick={() => navigate("/task-management")}>
              <GitBranch size={18} /> Team Tasks
            </div>
          )}

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

      {/* ── MAIN ── */}
      <div className="emp-main">
        {/* Topbar */}
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

            {/* ── Bell / Notifications ── */}
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
          {activeView === "requests" ? (
            <div style={{ padding: "10px 0" }}>
              <EmployeeRequestForm />
            </div>
          ) : activeView === "meetings" ? (
            <div style={{ padding: "10px 0" }}>
              <MeetingCalendar onClose={() => setActiveView("dashboard")} />
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
                  onClick={() => navigate("/apply-leave")}
                />
                <EmpActionCard
                  icon={<Calendar size={20} />}
                  name="View Attendance"
                  desc="Check your records"
                  accent="blue"
                  onClick={() => navigate("/attendance")}
                />
                <EmpActionCard
                  icon={<ClipboardList size={20} />}
                  name="Daily Report"
                  desc="Submit work update"
                  accent="purple"
                  onClick={() => navigate("/dpr", { state: { tasks: myTasks } })}
                />
                <EmpActionCard
                  icon={<MessageSquare size={20} />}
                  name="Requests"
                  desc="General documents"
                  accent="teal"
                  onClick={() => setActiveView("requests")}
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

              </div>

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
                          <td>{task.target_date || "—"}</td>
                          <td>{task.due_date ? new Date(task.due_date).toLocaleDateString() : "—"}</td>
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
  );
}

function EmpActionCard({ icon, name, desc, accent, onClick }) {
  return (
    <div className={`emp-action-card emp-action-${accent}`} onClick={onClick}>
      <div className="emp-action-icon">{icon}</div>
      <div>
        <div className="emp-action-name">{name}</div>
        <div className="emp-action-desc">{desc}</div>
      </div>
    </div>
  );
}
