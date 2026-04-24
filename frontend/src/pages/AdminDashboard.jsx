import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import {
  Users, LogOut, UserPlus,
  Calendar, Download, FileSpreadsheet,
  ClipboardCheck, LayoutDashboard, MessageSquare, Bell, Shield, CalendarCheck, Banknote, ClipboardList, Package
} from "lucide-react";
import AttendanceRecords from "./AttendanceRecords";
import BulkAttendance from "./BulkAttendance";
import AdminLeaveManagement from "./AdminLeaveManagement";
import TaskManagement from "./TaskManagement";
import PayslipGeneration from "./PayslipGeneration";
import AdminDPR from "./AdminDPR";
import CreateUser from "./CreateUser";

import AttendanceUpload from "./AttendanceUpload";
import RequestPanelContent from "../components/RequestPanelContent";
import DirectoryPanel from "./DirectoryPanel";

import "../styles/AdminDashboard.css";
import "../styles/EmployeeDashboard.css";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  });

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEmployees: 0,
    totalAdmins: 0,
    totalInterns: 0,
    activeEmployees: 0,
    presentToday: 0,
  });

  const [perms, setPerms] = useState({});
  const [bulletins, setBulletins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLeaveManagement, setShowLeaveManagement] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showAttRecords, setShowAttRecords] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showPayslip, setShowPayslip] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);

  const [showBulletinModal, setShowBulletinModal] = useState(false);
  const [bulletinTitle, setBulletinTitle] = useState("");
  const [bulletinContent, setBulletinContent] = useState("");
  const [bulletinPosting, setBulletinPosting] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(true);
  const notifRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const todayStr = new Date().toISOString().split("T")[0];
  const firstOfMonth = todayStr.slice(0, 7) + "-01";
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(todayStr);

  const todayNotifs = notifications.filter(n => n.created_at && n.created_at.startsWith(todayStr));

  useEffect(() => {
    const fetchNotificationsAndPerms = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        const [notifRes, permRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/notifications/my`, { headers }),
          axios.get(`${import.meta.env.VITE_API_URL}/permissions/my`, { headers }),
        ]);

        setNotifications(Array.isArray(notifRes.data) ? notifRes.data : []);

        const permMap = {};
        (Array.isArray(permRes.data) ? permRes.data : []).forEach(p => {
          permMap[p.feature_name] = { can_read: p.can_read, can_write: p.can_write };
        });
        setPerms(permMap);

      } catch (err) {
        console.error("Failed to fetch notifications/permissions:", err);
        setNotifications([]);
      } finally {
        setNotifLoading(false);
      }
    };
    fetchNotificationsAndPerms();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${import.meta.env.VITE_API_URL}/notifications/mark-read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Failed to mark notifications as read:", err);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [activeView, setActiveView] = useState("dashboard");

  const fetchDashboardData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return navigate("/login");
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, bulletinsRes, attendanceRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/employees/stats`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL}/bulletins`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL}/employees/attendance-today`, { headers }),
      ]);

      setStats({
        totalUsers: statsRes.data.totalUsers,
        totalEmployees: statsRes.data.totalEmployees,
        totalAdmins: statsRes.data.totalAdmins || 0,
        totalInterns: statsRes.data.totalInterns || 0,
        activeEmployees: statsRes.data.activeEmployees || 0,
        presentToday: attendanceRes.data.presentToday || 0,
      });
      setBulletins(bulletinsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!localStorage.getItem("token") || !localStorage.getItem("user")) {
      navigate("/login");
      return;
    }
    fetchDashboardData();
  }, [fetchDashboardData, navigate]);

  const handlePostBulletin = async () => {
    if (!bulletinContent.trim()) return;
    setBulletinPosting(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${import.meta.env.VITE_API_URL}/bulletins`,
        { title: bulletinTitle || "Bulletin", content: bulletinContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBulletinTitle("");
      setBulletinContent("");
      setShowBulletinModal(false);
      fetchDashboardData();
    } catch {
      alert("Failed to post bulletin.");
    } finally {
      setBulletinPosting(false);
    }
  };

  if (!user) return <div className="stdc-loading">Authenticating…</div>;
  if (loading) return <div className="stdc-loading">Loading dashboard…</div>;

  const pendingCount = stats.totalEmployees - stats.presentToday;
  const initials = (name = "") => name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const canRead = (feature) => perms[feature]?.can_read === true;
  const canWrite = (feature) => perms[feature]?.can_write === true;

  return (
    <div className="stdc-shell">

   
      <aside className="stdc-sidebar">
        <div className="stdc-logo-area">
          <div className="stdc-logo-mark">
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
              <div className="stdc-logo-text">UAV TECH</div>
              <div className="stdc-logo-sub">Admin Portal</div>
            </div>
          </div>
        </div>

        <nav className="stdc-nav">
          <div className="stdc-nav-label">Main</div>

          <div
            className={`stdc-nav-item ${activeView === "dashboard" ? "stdc-nav-active" : ""}`}
            onClick={() => setActiveView("dashboard")}
          >
            <LayoutDashboard size={18} /> Dashboard
          </div>

          <div
            className={`stdc-nav-item ${activeView === "request-panel" ? "stdc-nav-active" : ""}`}
            onClick={() => setActiveView("request-panel")}
          >
            <MessageSquare size={18} /> Request Panel
          </div>

          {canRead("leaves") && (
            <div
              className={`stdc-nav-item ${activeView === "leaves" ? "stdc-nav-active" : ""}`}
              onClick={() => setActiveView("leaves")}
            >
              <ClipboardCheck size={18} /> Leave Management
            </div>
          )}

          {canRead("directory") && (
            <div
              className={`stdc-nav-item ${activeView === "directory" ? "stdc-nav-active" : ""}`}
              onClick={() => setActiveView("directory")}
            >
              <Users size={18} /> Directory
            </div>
          )}

          {canRead("dpr") && (
            <div
              className={`stdc-nav-item ${activeView === "dpr" ? "stdc-nav-active" : ""}`}
              onClick={() => setActiveView("dpr")}
            >
              <ClipboardList size={18} /> DPR Overview
            </div>
          )}
        </nav>

        <div className="stdc-sidebar-footer">
          <button
            className="stdc-logout-btn"
            onClick={() => { localStorage.clear(); navigate("/login"); }}
          >
            <LogOut size={15} /> Logout
          </button>
        </div>
      </aside>

      
      <div className="stdc-main">

        <div className="stdc-topbar">
          <div className="stdc-topbar-left">
            <div className="stdc-page-title">
              {user?.role === 'admin_hr' ? 'HR Admin Dashboard' : 'Admin Dashboard'}
            </div>
          </div>

          <div style={{ flex: 1 }}></div>

          <button
            onClick={() => setShowBulletinModal(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", background: "#10b981", color: "#fff",
              border: "none", borderRadius: 8, fontFamily: "DM Sans, sans-serif",
              fontWeight: 700, fontSize: 13, cursor: "pointer", marginRight: 12
            }}
          >
            + New Bulletin
          </button>

          <div className="stdc-topbar-right">
            <div className="stdc-date-chip">
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
                        <div>You're all caught up!</div>
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

            <div className="stdc-avatar-pill">
              <div className="stdc-avatar">{initials(user?.fullname)}</div>
              <span className="stdc-avatar-name">{user?.fullname || "HR Admin"}</span>
            </div>
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div className="stdc-content">

          {activeView === "request-panel" ? (
            <RequestPanelContent role={user?.role || "admin"} />
          ) : activeView === "leaves" && canRead("leaves") ? (
            <AdminLeaveManagement />
          ) : activeView === "directory" && canRead("directory") ? (
            <DirectoryPanel />
          ) : activeView === "dpr" && canRead("dpr") ? (
            <AdminDPR />
          ) : activeView === "dashboard" ? (
            <>
              <div className="stdc-stats-row">
                <div className="stdc-stat-card">
                  <div className="stdc-stat-tag stdc-stat-tag-green">Team</div>
                  <div className="stdc-stat-icon-wrap"><Users size={24} /></div>
                  <div className="stdc-stat-number">{stats.totalEmployees}</div>
                  <div className="stdc-stat-label">Employees</div>
                </div>

                <div className="stdc-stat-card">
                  <div className="stdc-stat-tag stdc-stat-tag-blue">Team</div>
                  <div className="stdc-stat-icon-wrap"><UserPlus size={24} /></div>
                  <div className="stdc-stat-number">{stats.totalInterns}</div>
                  <div className="stdc-stat-label">Interns</div>
                </div>

                <div className="stdc-stat-card">
                  <div className="stdc-stat-tag stdc-stat-tag-yellow">Staff</div>
                  <div className="stdc-stat-icon-wrap"><Shield size={24} /></div>
                  <div className="stdc-stat-number">{stats.totalAdmins}</div>
                  <div className="stdc-stat-label">Admins</div>
                </div>

                <div className="stdc-stat-card">
                  <div className="stdc-stat-tag stdc-stat-tag-purple">Today</div>
                  <div className="stdc-stat-icon-wrap"><Calendar size={24} /></div>
                  <div className="stdc-stat-number">{stats.presentToday}</div>
                  <div className="stdc-stat-label">Present Today</div>
                </div>
              </div>

              {canRead("attendance") && (
                <div className="stdc-attendance-banner">
                  <div className="stdc-banner-left">
                    <h2>Today's Attendance</h2>
                    <p>Mark and track attendance for all employees</p>
                    {canWrite("attendance") ? (
                      <button className="stdc-post-attendance-btn" onClick={() => setShowBulk(true)}>
                        <ClipboardCheck size={15} /> Post Attendance
                      </button>
                    ) : (
                      <button className="stdc-post-attendance-btn" disabled style={{ opacity: 0.45, cursor: "not-allowed" }}>
                        <ClipboardCheck size={15} /> Post Attendance
                      </button>
                    )}
                  </div>
                  <div className="stdc-banner-stats">
                    <div className="stdc-banner-stat">
                      <div className="stdc-banner-stat-number">{stats.presentToday}</div>
                      <div className="stdc-banner-stat-label">Present</div>
                    </div>
                    <div className="stdc-banner-divider" />
                    <div className="stdc-banner-stat">
                      <div className="stdc-banner-stat-number">{pendingCount}</div>
                      <div className="stdc-banner-stat-label">Pending</div>
                    </div>
                    <div className="stdc-banner-divider" />
                    <div className="stdc-banner-stat">
                      <div className="stdc-banner-stat-number">{stats.totalEmployees}</div>
                      <div className="stdc-banner-stat-label">Total</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="stdc-section-header">
                <div className="stdc-section-title">Quick Actions</div>
              </div>

              <div className="stdc-actions-grid">
                <div className="stdc-action-card" onClick={() => setShowCreateUser(true)}>
                  <div className="stdc-action-icon"><UserPlus size={20} /></div>
                  <div>
                    <div className="stdc-action-label">Enroll Member</div>
                    <div className="stdc-action-desc">Add new member</div>
                  </div>
                </div>

                {canRead("upload_attendance") && (
                  <div className="stdc-action-card" onClick={() => setShowUpload(true)}>
                    <div className="stdc-action-icon"><FileSpreadsheet size={20} /></div>
                    <div>
                      <div className="stdc-action-label">Upload Attendance</div>
                      <div className="stdc-action-desc">Excel or Google Drive</div>
                    </div>
                  </div>
                )}

                {canRead("leaves") && (
                  <div
                    className="stdc-action-card"
                    onClick={() => canWrite("leaves") ? setShowLeaveManagement(true) : setActiveView("leaves")}
                  >
                    <div className="stdc-action-icon"><ClipboardCheck size={20} /></div>
                    <div>
                      <div className="stdc-action-label">Leave Management</div>
                      <div className="stdc-action-desc">
                        {canWrite("leaves") ? "Approve / Track Leaves" : "View Leaves (read only)"}
                      </div>
                    </div>
                  </div>
                )}

                {canRead("tasks") && (
                  <div className="stdc-action-card" onClick={() => setShowTaskModal(true)}>
                    <div className="stdc-action-icon"><ClipboardList size={20} /></div>
                    <div>
                      <div className="stdc-action-label">Tasks</div>
                      <div className="stdc-action-desc">Manage assignments</div>
                    </div>
                  </div>
                )}

                {canRead("payslips") && (
                  <div className="stdc-action-card" onClick={() => navigate("/payslip-approvals")}>
                    <div className="stdc-action-icon"><FileSpreadsheet size={20} /></div>
                    <div>
                      <div className="stdc-action-label">Certificate Requests</div>
                      <div className="stdc-action-desc">Approve employee requests</div>
                    </div>
                  </div>
                )}

                {canRead("payslips") && (
                  <div className="stdc-action-card" onClick={() => setShowPayslip(true)}>
                    <div className="stdc-action-icon"><Banknote size={20} /></div>
                    <div>
                      <div className="stdc-action-label">Payroll</div>
                      <div className="stdc-action-desc">Generate payslips</div>
                    </div>
                  </div>
                )}

                <div className="stdc-action-card" onClick={() => navigate("/meeting-calendar")}>
                  <div className="stdc-action-icon"><Calendar size={20} /></div>
                  <div>
                    <div className="stdc-action-label">Meetings</div>
                    <div className="stdc-action-desc">Meeting Calendar</div>
                  </div>
                </div>

                {canRead("attendance_records") && (
                  <div className="stdc-action-card" onClick={() => setShowAttRecords(true)}>
                    <div className="stdc-action-icon"><CalendarCheck size={20} /></div>
                    <div>
                      <div className="stdc-action-label">Attendance Records</div>
                      <div className="stdc-action-desc">View daily records</div>
                    </div>
                  </div>
                )}

                {canRead("attendance_reports") && (
                  <div className="stdc-action-card" onClick={() => setShowDownloadModal(true)}>
                    <div className="stdc-action-icon"><FileSpreadsheet size={20} /></div>
                    <div>
                      <div className="stdc-action-label">Reports</div>
                      <div className="stdc-action-desc">Export attendance data</div>
                    </div>
                  </div>
                )}

                <div className="stdc-action-card" onClick={() => window.open('/stock', '_blank')}>
                  <div className="stdc-action-icon"><Package size={20} /></div>
                  <div>
                    <div className="stdc-action-label">Workstock Pro</div>
                    <div className="stdc-action-desc">Manage Inventory & Stock</div>
                  </div>
                </div>

                {canRead("dpr") && (
                  <div className="stdc-action-card" onClick={() => setActiveView("dpr")}>
                    <div className="stdc-action-icon"><ClipboardList size={20} /></div>
                    <div>
                      <div className="stdc-action-label">DPR Overview</div>
                      <div className="stdc-action-desc">Review daily progress</div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}

          
          {(activeView === "dashboard" || activeView === "leaves" || activeView === "directory" || activeView === "request-panel" || activeView === "dpr") && (
            <div className="stdc-bottom-row" style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
              <div className="stdc-bottom-card">
                <div className="stdc-bottom-card-title">Bulletins</div>
                <div className="stdc-bulletin-container">
                  {bulletins.length > 0 ? (
                    <div className="stdc-bulletin-scroller">
                      {bulletins.map((bullet, i) => (
                        <div key={bullet.id ?? i} className="stdc-bulletin-item">
                          <strong className="stdc-bulletin-title">
                            {i + 1}. {bullet.title}
                          </strong>
                          <div className="stdc-bulletin-content">{bullet.content}</div>
                          <div className="stdc-bulletin-date">
                            {new Date(bullet.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="stdc-empty-text" style={{ fontSize: "12px", color: "#64748b" }}>
                      No new bulletins at this time.
                    </div>
                  )}
                </div>
              </div>

              <div className="stdc-bottom-card" onClick={() => setActiveView("request-panel")} style={{ cursor: "pointer" }}>
                <div className="stdc-bottom-card-title">Requests</div>
                <div className="stdc-empty-text" style={{ fontSize: "12px", color: "#64748b" }}>
                  Click here to view the Request Panel.
                </div>
              </div>

              <div className="stdc-bottom-card">
                <div className="stdc-bottom-card-title">Today's Notifications</div>
                {notifLoading ? (
                  <div className="stdc-empty-text" style={{ fontSize: "12px", color: "#64748b" }}>Loading…</div>
                ) : todayNotifs.length === 0 ? (
                  <div className="stdc-empty-text" style={{ fontSize: "12px", color: "#64748b" }}>No notifications today.</div>
                ) : (
                  <div style={{ fontSize: "13px" }}>
                    {todayNotifs.slice(0, 5).map((n, i) => (
                      <div key={n.id ?? i} style={{ padding: "6px 0", borderBottom: "1px solid #f1f5f9", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                        {!n.is_read && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4f46e5", flexShrink: 0, marginTop: 4 }} />}
                        <div>
                          <div style={{ color: "#1e293b" }}>{n.message}</div>
                          {n.created_at && (
                            <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: 2 }}>
                              {new Date(n.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {todayNotifs.length > 5 && (
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: 8, textAlign: "center" }}>
                        +{todayNotifs.length - 5} more • click bell icon for all
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      

      {showUpload && (
        <div className="stdc-overlay">
          <div className="stdc-modal-box" style={{ maxWidth: "520px" }}>
            <button className="stdc-modal-close-btn" onClick={() => setShowUpload(false)}>✕</button>
            <AttendanceUpload />
          </div>
        </div>
      )}

      {showLeaveManagement && (
        <div className="stdc-overlay">
          <div className="stdc-modal-box" style={{ width: "95%", maxWidth: "1200px" }}>
            <button className="stdc-modal-close-btn" onClick={() => setShowLeaveManagement(false)}>✕</button>
            <AdminLeaveManagement />
          </div>
        </div>
      )}

      {showBulk && (
        <div className="stdc-overlay">
          <div className="stdc-modal-box">
            <button className="stdc-modal-close-btn" onClick={() => setShowBulk(false)}>✕</button>
            <BulkAttendance />
          </div>
        </div>
      )}

      {showAttRecords && (
        <div className="stdc-overlay">
          <div className="stdc-modal-box">
            <button className="stdc-modal-close-btn" onClick={() => setShowAttRecords(false)}>✕</button>
            <AttendanceRecords />
          </div>
        </div>
      )}

      {showTaskModal && (
        <div className="stdc-overlay">
          <div className="stdc-modal-box">
            <button className="stdc-modal-close-btn" onClick={() => setShowTaskModal(false)}>✕</button>
            <TaskManagement />
          </div>
        </div>
      )}

      {showPayslip && (
        <div className="stdc-overlay">
          <div className="stdc-modal-box" style={{ maxWidth: "1000px" }}>
            <button className="stdc-modal-close-btn" onClick={() => setShowPayslip(false)}>✕</button>
            <PayslipGeneration />
          </div>
        </div>
      )}

      {showCreateUser && (
        <div className="stdc-overlay">
          <div className="stdc-modal-box" style={{ width: "95%", maxWidth: "1100px", padding: "0", background: "transparent" }}>
            <button
              className="stdc-modal-close-btn"
              style={{ top: "10px", right: "10px", zIndex: 1000, background: "#fff", borderRadius: "50%", width: "30px", height: "30px" }}
              onClick={() => setShowCreateUser(false)}
            >✕</button>
            <div style={{ background: "#fff", borderRadius: "12px", height: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div className="create-user-modal-inner" style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                <CreateUser
                  onClose={() => setShowCreateUser(false)}
                  onSuccess={() => {
                    setShowCreateUser(false);
                    fetchDashboardData();
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulletinModal && (
        <div className="stdc-overlay">
          <div className="stdc-modal-box" style={{ maxWidth: "480px" }}>
            <button className="stdc-modal-close-btn" onClick={() => setShowBulletinModal(false)}>✕</button>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#1e293b" }}>Post Bulletin</h3>
              <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Visible to all employees and admins.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontFamily: "DM Sans, sans-serif", outline: "none", width: "100%", boxSizing: "border-box" }}
                placeholder="Title (optional)"
                value={bulletinTitle}
                onChange={e => setBulletinTitle(e.target.value)}
              />
              <textarea
                style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontFamily: "DM Sans, sans-serif", outline: "none", resize: "vertical", minHeight: 100, width: "100%", boxSizing: "border-box" }}
                placeholder="Write your bulletin here..."
                value={bulletinContent}
                onChange={e => setBulletinContent(e.target.value)}
              />
              <button
                onClick={handlePostBulletin}
                disabled={bulletinPosting || !bulletinContent.trim()}
                style={{
                  padding: 11, background: "#10b981", color: "#fff", border: "none",
                  borderRadius: 8, fontFamily: "DM Sans, sans-serif", fontWeight: 700,
                  fontSize: 14, cursor: "pointer",
                  opacity: (bulletinPosting || !bulletinContent.trim()) ? 0.5 : 1
                }}
              >
                {bulletinPosting ? "Posting..." : "Post Bulletin"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDownloadModal && (
        <div className="stdc-overlay">
          <div className="stdc-modal-box stdc-download-modal">
            <button className="stdc-modal-close-btn" onClick={() => setShowDownloadModal(false)}>✕</button>
            <div className="stdc-dl-title"><Download size={18} /> Export Attendance</div>
            <div className="stdc-dl-subtitle">Select a date range to download the attendance report as Excel.</div>
            <div className="stdc-date-range-row">
              <div className="stdc-date-field">
                <label>From</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div className="stdc-date-arrow">→</div>
              <div className="stdc-date-field">
                <label>To</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
            </div>
            <div className="stdc-shortcuts">
              {["This Month", "Last Month", "Last 7 Days"].map(label => (
                <button key={label} className="stdc-shortcut-pill" onClick={() => {
                  const today = new Date();
                  if (label === "This Month") {
                    setFromDate(today.toISOString().slice(0, 7) + "-01");
                    setToDate(today.toISOString().split("T")[0]);
                  } else if (label === "Last Month") {
                    const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    const lme = new Date(today.getFullYear(), today.getMonth(), 0);
                    setFromDate(lm.toISOString().split("T")[0]);
                    setToDate(lme.toISOString().split("T")[0]);
                  } else {
                    const d = new Date(); d.setDate(d.getDate() - 6);
                    setFromDate(d.toISOString().split("T")[0]);
                    setToDate(today.toISOString().split("T")[0]);
                  }
                }}>{label}</button>
              ))}
            </div>
            <button
              className="stdc-dl-confirm-btn"
              disabled={!fromDate || !toDate}
              onClick={async () => {
                try {
                  const token = localStorage.getItem("token");
                  const res = await axios.get(
                    `${import.meta.env.VITE_API_URL}/attendance/export-excel?from=${fromDate}&to=${toDate}`,
                    { headers: { Authorization: `Bearer ${token}` }, responseType: "blob" }
                  );
                  const url = URL.createObjectURL(res.data);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `attendance_${fromDate}_to_${toDate}.xlsx`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } catch (err) {
                  alert("Failed to download report. Please try again.");
                }
              }}
            >
              <Download size={16} /> Download Excel Report
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
