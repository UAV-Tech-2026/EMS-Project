import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import "../styles/EmployeeDashboard.css";

export default function EmployeeDashboard() {
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [user,            setUser]            = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profilePic,      setProfilePic]      = useState(null);

  // KPI stats
  const [presentCount, setPresentCount] = useState(0);
  const [absentCount,  setAbsentCount]  = useState(0);
  const [leaveCount,   setLeaveCount]   = useState(0);

  // Dashboard data
  const [activity, setActivity] = useState([]);
  const [eodTasks, setEodTasks] = useState([]);
  const [myTasks,  setMyTasks]  = useState([]);

  // Loading / error states
  const [statsLoading,    setStatsLoading]    = useState(true);
  const [eodLoading,      setEodLoading]      = useState(true);
  const [tasksLoading,    setTasksLoading]    = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);

  // ── Load user from localStorage (runs first) ───────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        // Restore saved profile pic if any
        if (parsed.profilePic) setProfilePic(parsed.profilePic);
      } catch {
        // corrupted storage — clear and redirect to login
        localStorage.clear();
        navigate("/login");
      }
    }
  }, [navigate]);

  // ── Fetch attendance stats ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get("/attendance/stats/my");
        setPresentCount(res.data.presentCount ?? 0);
        setAbsentCount(res.data.absentCount   ?? 0);
        setLeaveCount(res.data.leaveCount     ?? 0);
      } catch (err) {
        console.error("Failed to fetch attendance stats:", err);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, []);

  // ── Fetch EOD tasks ────────────────────────────────────────────────────────
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

  // ── Fetch assigned tasks ───────────────────────────────────────────────────
  // BUG FIX: filter by assigned_to_name case-insensitively + trimmed
  useEffect(() => {
    const fetchMyTasks = async () => {
      try {
        const res    = await api.get("/tasks/list");
        const stored = localStorage.getItem("user");
        if (stored) {
          const parsed   = JSON.parse(stored);
          const myName   = (parsed.fullname || "").trim().toLowerCase();
          const filtered = (res.data || []).filter(
            t => (t.assigned_to_name || "").trim().toLowerCase() === myName
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

  // ── Fetch activity log ─────────────────────────────────────────────────────
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

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    localStorage.clear();
    navigate("/login");
  }, [navigate]);

  const handleProfilePicUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imageDataUrl = reader.result;
      setProfilePic(imageDataUrl);
      setUser(prev => {
        const updated = { ...prev, profilePic: imageDataUrl };
        localStorage.setItem("user", JSON.stringify(updated));
        return updated;
      });
    };
    reader.readAsDataURL(file);
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const isLead = user?.designation?.toLowerCase().includes("lead");

  // BUG FIX: parse deadline with explicit time to avoid UTC offset issues in IST
  const parseDeadline = (deadlineStr) => {
    if (!deadlineStr) return null;
    // If it's a date-only string like "2026-03-26", append time to avoid UTC midnight shift
    return deadlineStr.length === 10
      ? new Date(deadlineStr + "T00:00:00")
      : new Date(deadlineStr);
  };

  const getEodCardStatus = (task) => {
    const deadline = parseDeadline(task.deadline);
    const now      = new Date();
    if (task.status === "done" || task.status === "Completed") return "done";
    if (deadline && now > deadline)                             return "overdue";
    if (deadline && deadline - now < 2 * 60 * 60 * 1000)      return "soon";
    return "pending";
  };

  const STATUS_META = {
    done:    { cardClass: "eod-card--done",    badgeClass: "badge--done",    label: "✓ Done"      },
    overdue: { cardClass: "eod-card--overdue", badgeClass: "badge--overdue", label: "⚠ Overdue"   },
    soon:    { cardClass: "eod-card--soon",    badgeClass: "badge--soon",    label: "⏰ Due Soon"  },
    pending: { cardClass: "eod-card--pending", badgeClass: "badge--pending", label: "🕐 Pending"  },
  };

  const TASK_STATUS_STYLE = {
    Completed:   { bg: "#dcfce7", color: "#166534" },
    "In Progress": { bg: "#fef08a", color: "#854d0e" },
    default:     { bg: "#f1f5f9", color: "#475569"  },
  };

  const getTaskStyle = (status) =>
    TASK_STATUS_STYLE[status] || TASK_STATUS_STYLE.default;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="empdb__layout">

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="empdb__sidebar">
          <div className="empdb__logo">
            UAV Tech Pvt Ltd
            <span>Employee Portal</span>
          </div>

          <nav className="empdb__nav">
            <a className="empdb__nav-link empdb__nav-link--active"
               onClick={() => navigate("/employee-dashboard")}>🏠 Dashboard</a>
            <a className="empdb__nav-link"
               onClick={() => navigate("/attendance")}>📅 View Attendance</a>
            <a className="empdb__nav-link"
               onClick={() => navigate("/apply-leave")}>🌴 Leave</a>
            <a className="empdb__nav-link"
               onClick={() => navigate("/dpr")}>📝 Daily Report</a>
            <a className="empdb__nav-link"
               onClick={() => navigate("/payslips")}>💰 Payslips</a>
            <a className="empdb__nav-link"
               onClick={() => navigate("/documents")}>📄 Documents</a>
            {isLead && (
              <a className="empdb__nav-link"
                 onClick={() => navigate("/task-management")}>📊 Tasks (Lead)</a>
            )}
            <a className="empdb__nav-link"
               onClick={() => navigate("/settings")}>⚙️ Settings</a>
          </nav>

          <button className="empdb__sidebar-logout" onClick={handleLogout}>
            🚪 Logout
          </button>
        </aside>

        {/* ── Main ─────────────────────────────────────────────────────────── */}
        <div className="empdb__main">

          {/* Header */}
          <header className="empdb__header">
            <div>
              <h2 className="empdb__header-title">Employee Dashboard</h2>
              <p className="empdb__header-sub">
                Welcome back, {user?.fullname || user?.name || "Employee"} 👋
              </p>
            </div>

            <div className="empdb__topbar-right">
              <div className="empdb__profile"
                   onClick={() => setShowProfileMenu(p => !p)}>
                {profilePic ? (
                  <img src={profilePic} alt="Profile" className="empdb__avatar" />
                ) : (
                  <div className="empdb__avatar-placeholder">
                    {user?.fullname?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                )}

                {showProfileMenu && (
                  <div className="empdb__profile-menu"
                       onClick={e => e.stopPropagation()}>
                    <p className="empdb__profile-name">{user?.fullname}</p>
                    <p className="empdb__profile-email">{user?.email}</p>
                    <label className="empdb__profile-upload-label">
                      📷 Change Photo
                      <input
                        type="file"
                        accept="image/*"
                        className="empdb__profile-file"
                        onChange={handleProfilePicUpload}
                      />
                    </label>
                    <button className="empdb__logout-btn" onClick={handleLogout}>
                      🚪 Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* KPI Cards */}
          <section className="empdb__kpi-grid">
            {[
              { label: "Present Days",  value: statsLoading ? "…" : presentCount, accent: false },
              { label: "Absent",        value: statsLoading ? "…" : absentCount,  accent: false },
              { label: "Leaves Taken",  value: statsLoading ? "…" : leaveCount,   accent: false },
              { label: "Performance",   value: "N/A",                              accent: true  },
            ].map(({ label, value, accent }) => (
              <div key={label} className="empdb__kpi-card">
                <div className="empdb__kpi-label">{label}</div>
                <div className={`empdb__kpi-value${accent ? " empdb__kpi-value--accent" : ""}`}>
                  {value}
                </div>
              </div>
            ))}
          </section>

          {/* Quick Actions */}
          <section className="empdb__section">
            <h3 className="empdb__section-title">Quick Actions</h3>
            <div className="empdb__action-grid">
              <ActionCard title="Apply Leave"          desc="Submit leave request"            btn="Apply"        onClick={() => navigate("/apply-leave")} />
              <ActionCard title="View Attendance"      desc="Check your attendance records"   btn="View"         onClick={() => navigate("/attendance")} />
              <ActionCard
                title="Daily Progress Report"
                desc="Submit today's work update"
                btn="Submit DPR"
                // BUG FIX: pass myTasks via route state so DPR page can pre-fill task list
                onClick={() => navigate("/dpr", { state: { tasks: myTasks } })}
              />
              <ActionCard title="Documents"   desc="Upload or view files"            btn="Upload"       onClick={() => navigate("/documents")} />
              <ActionCard title="Payslips"    desc="Download your monthly payslips"  btn="View Payslips" onClick={() => navigate("/payslips")} />
              <ActionCard title="Update Profile" desc="Edit personal info"           btn="Edit"         onClick={() => navigate("/settings")} />
              {isLead && (
                <ActionCard title="Task Management" desc="Manage Team Tasks"         btn="Manage Tasks"  onClick={() => navigate("/task-management")} />
              )}
            </div>
          </section>

          {/* Recent Activity */}
          <section className="empdb__section">
            <h3 className="empdb__section-title">Recent Activity</h3>
            <ul className="empdb__activity-list">
              {activityLoading ? (
                <li className="empdb__activity-empty">Loading activity…</li>
              ) : activity.length === 0 ? (
                <li className="empdb__activity-empty">No recent activity</li>
              ) : (
                activity.map((item, index) => (
                  <li key={index} className="empdb__activity-item">
                    <span className="empdb__activity-dot" />
                    {item}
                  </li>
                ))
              )}
            </ul>
          </section>

          {/* EOD Tasks */}
          <section className="empdb__section">
            <h3 className="empdb__section-title">📋 Today's EOD Task Status</h3>
            {eodLoading ? (
              <p className="empdb__eod-empty">Loading tasks…</p>
            ) : eodTasks.length === 0 ? (
              <p className="empdb__eod-empty">No tasks assigned for today.</p>
            ) : (
              <div className="empdb__eod-grid">
                {eodTasks.map((task, i) => {
                  const status   = getEodCardStatus(task);
                  const meta     = STATUS_META[status];
                  const deadline = parseDeadline(task.deadline);

                  return (
                    <div key={i} className={`empdb__eod-card ${meta.cardClass}`}>
                      <div className="empdb__eod-top">
                        <span className={`empdb__eod-title${status === "overdue" ? " empdb__eod-title--overdue" : ""}`}>
                          {task.title}
                        </span>
                        <span className={`empdb__badge ${meta.badgeClass}`}>{meta.label}</span>
                      </div>
                      {task.description && (
                        <p className="empdb__eod-desc">{task.description}</p>
                      )}
                      {deadline && (
                        <div className="empdb__eod-meta">
                          🗓 {deadline.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          {" — "}
                          {deadline.toLocaleDateString("en-IN")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* My Task Load */}
          <section className="empdb__section">
            <div className="empdb__section-header">
              <h3 className="empdb__section-title">🔥 My Task Load</h3>
              <button
                className="empdb__action-btn"
                style={{ padding: "6px 14px", fontSize: "13px" }}
                onClick={() => navigate("/task-management")}
              >
                View All
              </button>
            </div>

            <div className="empdb__table-wrap">
              <table className="empdb__table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Man Hours</th>
                    <th>Due Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tasksLoading ? (
                    <tr><td colSpan="4" className="empdb__table-empty">Loading tasks…</td></tr>
                  ) : myTasks.length === 0 ? (
                    <tr><td colSpan="4" className="empdb__table-empty">No active tasks assigned!</td></tr>
                  ) : (
                    myTasks.map(task => {
                      const { bg, color } = getTaskStyle(task.status);
                      return (
                        <tr key={task.id}>
                          {/* BUG FIX: was fontWeight:"no" — now valid value "500" */}
                          <td style={{ fontWeight: "500" }}>{task.title}</td>
                          <td>{task.man_hours || "—"}</td>
                          <td>
                            {task.due_date
                              ? new Date(task.due_date + "T00:00:00").toLocaleDateString("en-IN")
                              : "—"}
                          </td>
                          <td>
                            <span className="empdb__task-badge" style={{ backgroundColor: bg, color }}>
                              {task.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Announcement */}
          <section className="empdb__section empdb__announcement">
            <h3 className="empdb__section-title">Company Announcement</h3>
            <p className="empdb__announcement-text">
              Company Annual Meeting on 25th January
            </p>
          </section>

        </div>
      </div>
    </>
  );
}

// ── Small reusable card ────────────────────────────────────────────────────────
function ActionCard({ title, desc, btn, onClick }) {
  return (
    <div className="empdb__action-card">
      <div className="empdb__action-title">{title}</div>
      <div className="empdb__action-desc">{desc}</div>
      <button className="empdb__action-btn" onClick={onClick}>{btn}</button>
    </div>
  );
}