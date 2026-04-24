import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import {
  Users, LogOut, UserPlus,
  Calendar, Download, ClipboardList,
  ClipboardCheck, Shield, LayoutDashboard, MessageSquare, CalendarCheck, Bell, Package, Briefcase, FileSpreadsheet, Banknote
} from "lucide-react";
import ControlPanel from "./ControlPanel";
import AttendanceRecords from "./AttendanceRecords";
import TaskManagement from "./TaskManagement";
import BulkAttendance from "./BulkAttendance";
import SuperAdminProfile from "./SuperAdminProfile";
import PayslipGeneration from "./PayslipGeneration";
import AdminLeaveManagement from "./AdminLeaveManagement";
import AdminDPR from "./AdminDPR";
import CreateUser from "./CreateUser";
import Departments from "./Departments";

import AttendanceUpload from "./AttendanceUpload";
import RequestPanelContent from "../components/RequestPanelContent";
import "../styles/SuperAdminDashboard.css";
import "../styles/EmployeeDashboard.css";

import PayslipApprovals from "./PayslipApprovals";
import DirectoryPanel from "./DirectoryPanel";

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEmployees: 0,
    totalAdmins: 0,
    totalInterns: 0,
    activeEmployees: 0,
    presentToday: 0,
  });

  const [bulletins, setBulletins] = useState([]);
  const [bulletinForm, setBulletinForm] = useState({ title: "", content: "" });
  const [showBulletinModal, setShowBulletinModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showLeaveManagement, setShowLeaveManagement] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showPayslip, setShowPayslip] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showAttRecords, setShowAttRecords] = useState(false);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);

  // ── Notifications state ──
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(true);
  const notifRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // ── Fetch notifications ──
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/notifications/my`, {
          headers: { Authorization: `Bearer ${token}` }
        });
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

  const [activeView, setActiveView] = useState("dashboard");

  const todayStr = new Date().toISOString().split("T")[0];
  const firstOfMonth = todayStr.slice(0, 7) + "-01";
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(todayStr);

  useEffect(() => {
    const fetchDashboardData = async () => {
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
    };
    fetchDashboardData();
  }, [navigate]);

  const refreshStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [statsRes, attendanceRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/employees/stats`, { headers }),
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
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostBulletin = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${import.meta.env.VITE_API_URL}/bulletins`, bulletinForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowBulletinModal(false);
      setBulletinForm({ title: "", content: "" });
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/bulletins`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBulletins(res.data);
    } catch (err) {
      console.error(err);
      alert("Failed to post bulletin");
    }
  };

  if (!user) return <div className="sad-loading">Authenticating…</div>;
  if (loading) return <div className="sad-loading">Loading dashboard…</div>;

  const pendingCount = stats.totalEmployees - stats.presentToday;
  const initials = (name = "") => name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const todayNotifs = notifications.filter(n => n.created_at && n.created_at.startsWith(todayStr));

  return (
    <div className="sad-shell">

      {/* ── SIDEBAR ── */}
      <aside className="sad-sidebar">
        <div className="sad-logo-area">
          <div className="sad-logo-mark">
            <div style={{
              width: 40, height: 40,
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
              <div className="sad-logo-text">UAV TECH</div>
              <div className="sad-logo-sub">Super Admin Portal</div>
            </div>
          </div>
        </div>

        <nav className="sad-nav">
          <div className="sad-nav-label">Main</div>

          <div
            className={`sad-nav-item ${activeView === "dashboard" ? "sad-active" : ""}`}
            onClick={() => setActiveView("dashboard")}
          >
            <LayoutDashboard size={18} /> Dashboard
          </div>

          <div
            className={`sad-nav-item ${activeView === "request-panel" ? "sad-active" : ""}`}
            onClick={() => setActiveView("request-panel")}
          >
            <MessageSquare size={18} /> Request Panel
          </div>



          {/* ── Payroll removed from sidebar ── */}

          <div
            className="sad-nav-item"
            onClick={() => setShowControlPanel(true)}
          >
            <Shield size={18} /> Control Panel
          </div>

          <div
            className={`sad-nav-item ${activeView === "directory" ? "sad-active" : ""}`}
            onClick={() => setActiveView("directory")}
          >
            <Users size={18} /> Directory
          </div>

          <div
            className={`sad-nav-item ${activeView === "departments" ? "sad-active" : ""}`}
            onClick={() => setActiveView("departments")}
          >
            <Briefcase size={18} /> Departments
          </div>



        </nav>
        <div className="sad-sidebar-footer">
          <button
            className="sad-logout"
            onClick={() => { localStorage.clear(); navigate("/login"); }}
          >
            <LogOut size={15} /> Logout
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="sad-main">
        {/* Topbar */}
        <div className="sad-topbar">
          <div className="sad-topbar-left">
            <div className="sad-page-title">Super Admin Dashboard</div>
          </div>

          <div style={{ flex: 1 }}></div>

          <div className="sad-topbar-right">
            <button className="sad-post-btn" onClick={() => setShowBulletinModal(true)} style={{ padding: "8px 16px" }}>
              + New Bulletin
            </button>
            <div className="sad-date-chip">
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

            <div className="sad-profile-pill" onClick={() => setShowProfileModal(true)}>
              <div className="sad-avatar">{initials(user?.fullname)}</div>
              <span className="sad-avatar-name">{user?.fullname || "Super Admin"}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="sad-content">

          {activeView === "request-panel" ? (
            <RequestPanelContent role="super_admin" />
          ) : activeView === "leaves" ? (
            <AdminLeaveManagement />
          ) : activeView === "directory" ? (
            <DirectoryPanel />
          ) : activeView === "dpr" ? (
            <AdminDPR />
          ) : activeView === "departments" ? (
            <Departments />
          ) : null}

          {/* ── Dashboard (Stats, Hero, Actions) ── */}
          {activeView === "dashboard" && (
            <>
              {/* ── Stat cards ── */}
              <div className="sad-stats-row">
                <div className="sad-stat-card sad-teal">
                  <div className="sad-stat-badge">Team</div>
                  <div className="sad-stat-icon"><Users size={24} /></div>
                  <div className="sad-stat-number">{stats.totalEmployees}</div>
                  <div className="sad-stat-label">Employees</div>
                </div>

                <div className="sad-stat-card sad-blue">
                  <div className="sad-stat-badge">Team</div>
                  <div className="sad-stat-icon"><UserPlus size={24} /></div>
                  <div className="sad-stat-number">{stats.totalInterns}</div>
                  <div className="sad-stat-label">Interns</div>
                </div>

                <div className="sad-stat-card sad-green">
                  <div className="sad-stat-badge">Staff</div>
                  <div className="sad-stat-icon"><Shield size={24} /></div>
                  <div className="sad-stat-number">{stats.totalAdmins}</div>
                  <div className="sad-stat-label">Admins</div>
                </div>

                <div className="sad-stat-card sad-purple">
                  <div className="sad-stat-badge">Today</div>
                  <div className="sad-stat-icon"><Calendar size={24} /></div>
                  <div className="sad-stat-number">{stats.presentToday}</div>
                  <div className="sad-stat-label">Present Today</div>
                </div>
              </div>

              {/* ── Attendance hero ── */}
              <div className="sad-att-hero">
                <div className="sad-ah-left">
                  <h3>Today's Attendance</h3>
                  <p>Mark and track attendance for all employees</p>
                  <button className="sad-post-btn" onClick={() => setShowBulk(true)}>
                    <ClipboardCheck size={15} /> Post Attendance
                  </button>
                </div>
                <div className="sad-ah-right">
                  <div className="sad-ah-stat">
                    <div className="sad-ah-num">{stats.presentToday}</div>
                    <div className="sad-ah-lbl">Present</div>
                  </div>
                  <div className="sad-ah-divider" />
                  <div className="sad-ah-stat">
                    <div className="sad-ah-num">{pendingCount}</div>
                    <div className="sad-ah-lbl">Pending</div>
                  </div>
                  <div className="sad-ah-divider" />
                  <div className="sad-ah-stat">
                    <div className="sad-ah-num">{stats.totalEmployees}</div>
                    <div className="sad-ah-lbl">Total</div>
                  </div>
                </div>
              </div>

              {/* ── Quick Actions ── */}
              <div className="sad-section-header">
                <div className="sad-section-title">Quick Actions</div>
              </div>

              <div className="sad-actions-grid">
                <div className="sad-action-card sad-ac-enroll" onClick={() => setShowCreateUser(true)}>
                  <div className="sad-action-icon"><UserPlus size={20} /></div>
                  <div>
                    <div className="sad-action-name">Enroll Member</div>
                    <div className="sad-action-desc">Add new Admin/Employee</div>
                  </div>
                </div>

                <div className="sad-action-card sad-ac-dl" onClick={() => setShowUpload(true)}>
                  <div className="sad-action-icon"><FileSpreadsheet size={20} /></div>
                  <div>
                    <div className="sad-action-name">Upload Attendance</div>
                    <div className="sad-action-desc">Excel or Google Drive</div>
                  </div>
                </div>

                <div
                  className="sad-action-card sad-ac-leave"
                  onClick={() => setShowLeaveManagement(true)}
                >
                  <div className="sad-action-icon">
                    <ClipboardCheck size={20} />
                  </div>
                  <div>
                    <div className="sad-action-name">Leave Management</div>
                    <div className="sad-action-desc">Approve / Track Leaves</div>
                  </div>
                </div>

                <div className="sad-action-card sad-ac-task" onClick={() => setShowTaskModal(true)}>
                  <div className="sad-action-icon"><ClipboardList size={20} /></div>
                  <div>
                    <div className="sad-action-name">Tasks</div>
                    <div className="sad-action-desc">Manage assignments</div>
                  </div>
                </div>

                <div className="sad-action-card sad-ac-pay" onClick={() => navigate("/payslip-approvals")}>
                  <div className="sad-action-icon"><FileSpreadsheet size={20} /></div>
                  <div>
                    <div className="sad-action-name">Certificate Requests</div>
                    <div className="sad-action-desc">Approve employee requests</div>
                  </div>
                </div>

                {/* ── Payroll card opens PayslipGeneration modal ── */}
                <div className="sad-action-card sad-ac-pay" onClick={() => setShowPayslip(true)}>
                  <div className="sad-action-icon"><Banknote size={20} /></div>
                  <div>
                    <div className="sad-action-name">Payroll</div>
                    <div className="sad-action-desc">Generate payslips</div>
                  </div>
                </div>

                <div className="sad-action-card sad-ac-cal" onClick={() => navigate("/meeting-calendar")}>
                  <div className="sad-action-icon"><Calendar size={20} /></div>
                  <div>
                    <div className="sad-action-name">Meetings</div>
                    <div className="sad-action-desc">Meeting Calendar</div>
                  </div>
                </div>

                <div className="sad-action-card sad-ac-reports" onClick={() => setShowDownloadModal(true)}>
                  <div className="sad-action-icon"><FileSpreadsheet size={20} /></div>
                  <div>
                    <div className="sad-action-name">Reports</div>
                    <div className="sad-action-desc">Export attendance data</div>
                  </div>
                </div>

                <div className="sad-action-card sad-ac-stock" onClick={() => window.open('/stock', '_blank')}>
                  <div className="sad-action-icon"><Package size={20} /></div>
                  <div>
                    <div className="sad-action-name">Workstock Pro</div>
                    <div className="sad-action-desc">Manage Inventory & Stock</div>
                  </div>
                </div>

                <div className="sad-action-card sad-ac-dpr" onClick={() => setActiveView("dpr")}>
                  <div className="sad-action-icon"><ClipboardList size={20} /></div>
                  <div>
                    <div className="sad-action-name">DPR Overview</div>
                    <div className="sad-action-desc">Review daily progress</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Persistent Bottom Row ── */}
          {(activeView === "dashboard" || activeView === "control-panel" || activeView === "leaves" || activeView === "directory" || activeView === "request-panel" || activeView === "dpr") && (
            <div className="sad-bottom-row" style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
              <div className="sad-bottom-card">
                <div className="sad-section-title" style={{ marginBottom: "15px" }}>Bulletins</div>
                <div className="sad-bulletin-container">
                  {bulletins.length > 0 ? (
                    <div className="sad-bulletin-scroller" style={{ fontSize: "13px", lineHeight: "1.5", color: "var(--sad-text)" }}>
                      {bulletins.map((bullet, i) => (
                        <div key={bullet.id ?? i} style={{ marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                          <strong style={{ display: "block", marginBottom: "4px", color: "#4f46e5" }}>
                            {i + 1}. {bullet.title}
                          </strong>
                          {bullet.content}
                          <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "4px" }}>
                            {new Date(bullet.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="sad-placeholder-text" style={{ fontSize: "12px", color: "#64748b" }}>
                      No new bulletins at this time.
                    </div>
                  )}
                </div>
              </div>

              <div className="sad-bottom-card" onClick={() => setActiveView("request-panel")} style={{ cursor: "pointer" }}>
                <div className="sad-section-title" style={{ marginBottom: "15px" }}>Requests</div>
                <div className="sad-placeholder-text" style={{ fontSize: "12px", color: "#64748b" }}>
                  Click here to view the Request Panel.
                </div>
              </div>

              <div className="sad-bottom-card">
                <div className="sad-section-title" style={{ marginBottom: "15px" }}>Today's Notifications</div>
                {notifLoading ? (
                  <div className="sad-placeholder-text" style={{ fontSize: "12px", color: "#64748b" }}>Loading…</div>
                ) : todayNotifs.length === 0 ? (
                  <div className="sad-placeholder-text" style={{ fontSize: "12px", color: "#64748b" }}>No notifications today.</div>
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
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: 8, textAlign: "center" }}>+{todayNotifs.length - 5} more • click bell icon for all</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── MODALS ── */}

      {showBulletinModal && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content" style={{ maxWidth: "500px", padding: "24px" }}>
            <button className="sad-modal-close" onClick={() => setShowBulletinModal(false)}>✕</button>
            <h2 style={{ marginTop: 0, marginBottom: "20px" }}>Post New Bulletin</h2>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "600" }}>Title <span style={{ color: "red" }}>*</span></label>
              <input
                type="text"
                value={bulletinForm.title}
                onChange={(e) => setBulletinForm({ ...bulletinForm, title: e.target.value })}
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }}
                placeholder="Enter bulletin title"
              />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "600" }}>Message <span style={{ color: "red" }}>*</span></label>
              <textarea
                value={bulletinForm.content}
                onChange={(e) => setBulletinForm({ ...bulletinForm, content: e.target.value })}
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", minHeight: "120px", resize: "vertical" }}
                placeholder="Enter your message here"
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                className="sad-close-section-btn"
                onClick={() => setShowBulletinModal(false)}
                style={{ background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#374151", padding: "8px 16px", borderRadius: "6px", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                className="sad-post-btn"
                onClick={handlePostBulletin}
                disabled={!bulletinForm.title || !bulletinForm.content}
                style={{ opacity: (!bulletinForm.title || !bulletinForm.content) ? 0.6 : 1 }}
              >
                Publish
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content" style={{ maxWidth: "520px" }}>
            <button className="sad-modal-close" onClick={() => setShowUpload(false)}>✕</button>
            <AttendanceUpload />
          </div>
        </div>
      )}

      {showLeaveManagement && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content" style={{ width: "95%", maxWidth: "1200px" }}>
            <button
              className="sad-modal-close"
              onClick={() => setShowLeaveManagement(false)}
            >
              ✕
            </button>
            <AdminLeaveManagement />
          </div>
        </div>
      )}

      {showTaskModal && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content">
            <button className="sad-modal-close" onClick={() => setShowTaskModal(false)}>✕</button>
            <TaskManagement />
          </div>
        </div>
      )}

      {showBulk && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content">
            <button className="sad-modal-close" onClick={() => setShowBulk(false)}>✕</button>
            <BulkAttendance />
          </div>
        </div>
      )}

      {showControlPanel && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content" style={{ width: "95%", maxWidth: "1000px" }}>
            <button className="sad-modal-close" onClick={() => setShowControlPanel(false)}>✕</button>
            <ControlPanel />
          </div>
        </div>
      )}

      {showCreateUser && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content" style={{ width: "98%", maxWidth: "1200px", padding: "0", background: "transparent" }}>
            <button className="sad-modal-close" style={{ top: "15px", right: "15px", zIndex: 1000, background: "#fff", border: "1px solid #e2e8f0", borderRadius: "50%", width: "32px", height: "32px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }} onClick={() => setShowCreateUser(false)}>✕</button>
            <div style={{ background: "#fff", borderRadius: "16px", height: "92vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div className="create-user-modal-inner" style={{ flex: 1, overflowY: "auto", padding: "30px" }}>
                <CreateUser
                  onClose={() => setShowCreateUser(false)}
                  onSuccess={() => {
                    setShowCreateUser(false);
                    refreshStats();
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && (
        <SuperAdminProfile onClose={() => setShowProfileModal(false)} />
      )}

      {showAttRecords && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content">
            <button className="sad-modal-close" onClick={() => setShowAttRecords(false)}>✕</button>
            <AttendanceRecords />
          </div>
        </div>
      )}

      {/* ── Payroll Modal (opened from Quick Action card) ── */}
      {showPayslip && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content" style={{ width: "95%", maxWidth: "1200px" }}>
            <button className="sad-modal-close" onClick={() => setShowPayslip(false)}>✕</button>
            <PayslipGeneration />
          </div>
        </div>
      )}

      {showDownloadModal && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content sad-download-modal">
            <button className="sad-modal-close" onClick={() => setShowDownloadModal(false)}>✕</button>
            <div className="sad-dl-title"><Download size={18} /> Export Attendance</div>
            <div className="sad-dl-subtitle">Select a date range to download the attendance report as Excel.</div>
            <div className="sad-date-range-row">
              <div className="sad-date-field">
                <label>From</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div className="sad-date-arrow">→</div>
              <div className="sad-date-field">
                <label>To</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
            </div>
            <div className="sad-shortcuts">
              {["This Month", "Last Month", "Last 7 Days"].map(label => (
                <button key={label} className="sad-shortcut-pill" onClick={() => {
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
            <div className="sad-dl-includes">
              <strong>Includes</strong>
              Monthly Summary Sheet · Daily Logs Sheet · Hours Worked · Leave Breakdown
            </div>
            <button
              className="sad-dl-confirm-btn"
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
