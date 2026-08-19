import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, API_URL } from "../utils/api";

import {
  Users, LogOut, UserPlus,
  Calendar, Download, ClipboardList,
  ClipboardCheck, Shield, LayoutDashboard, MessageSquare, CalendarCheck, Bell, Package, Briefcase, FileSpreadsheet, Banknote, Building2
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
import MeetingCalendar from "./MeetingCalendar";

import AttendanceUpload from "./AttendanceUpload";
import RequestPanelContent from "../components/RequestPanelContent";
import "../styles/SuperAdminDashboard.css";
import "../styles/EmployeeDashboard.css";

import PayslipApprovals from "./PayslipApprovals";
import DirectoryPanel from "./DirectoryPanel";


export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  // Read from sessionStorage into state so the component re-renders
  // when DashboardSwitcher updates the user after its background refresh.
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("user")); }
    catch { return null; }
  });

  // If user is null on mount, try once more then redirect
  useEffect(() => {
    if (!user) {
      try {
        const stored = JSON.parse(sessionStorage.getItem("user"));
        if (stored) setUser(stored);
        else navigate("/login", { replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    }
  }, []);

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
  const [showMeeting, setShowMeeting] = useState(false);
  const [showDepartments, setShowDepartments] = useState(false);
  const [directoryFilter, setDirectoryFilter] = useState(null); // "employee" | "intern" | "admin" | "present" | null

  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(true);
  const notifRef = useRef(null);

  const [pendingRequests, setPendingRequests] = useState([]);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const pendingRequestCount = pendingRequests.filter(r => r.status === "pending").length;

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = sessionStorage.getItem("token");
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

  const handleMarkAllRead = async () => {
    try {
      const token = sessionStorage.getItem("token");
      await api.post("/notifications/mark-read", {});
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

  const todayStr = new Date().toISOString().split("T")[0];
  const firstOfMonth = todayStr.slice(0, 7) + "-01";
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(todayStr);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = sessionStorage.getItem("token");
        if (!token) return navigate("/login");

        const [statsRes, bulletinsRes, attendanceRes, reqRes] = await Promise.all([
          api.get("/employees/stats"),
          api.get("/bulletins"),
          api.get("/employees/attendance-today"),
          api.get("/general-requests/admin").catch(() => ({ data: [] })),
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
        setPendingRequests(Array.isArray(reqRes.data) ? reqRes.data : []);
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
      const token = sessionStorage.getItem("token");
      const [statsRes, attendanceRes] = await Promise.all([
        api.get("/employees/stats"),
        api.get("/employees/attendance-today"),
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
      const token = sessionStorage.getItem("token");
      await api.post("/bulletins", bulletinForm);
      setShowBulletinModal(false);
      setBulletinForm({ title: "", content: "" });
      const res = await api.get("/bulletins");
      setBulletins(res.data);
    } catch (err) {
      console.error(err);
      alert("Failed to post bulletin");
    }
  };

  if (!user) return <div className="sad-loading">Loading…</div>;
  if (loading) return <div className="sad-loading">Loading dashboard…</div>;

  const pendingCount = stats.totalEmployees - stats.presentToday;
  const initials = (name = "") => name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const todayNotifs = notifications.filter(n => n.created_at && n.created_at.startsWith(todayStr));

  // ── WorkStockPro iframe URL ──
  const workstockToken = sessionStorage.getItem("token");
  const workstockUrl = `${import.meta.env.VITE_WORKSTOCK_URL || `http://${window.location.hostname}:3001`}?token=${workstockToken}`;

  return (
    <div className="sad-shell">

      {/* ── SIDEBAR ── */}
      <aside className="sad-sidebar">
        <div className="sad-logo-area">
          <div className="sad-logo-mark">
            <div style={{
              width: 56, height: 56,
              background: "#ffffff",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
              boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
              padding: 6,
              boxSizing: "border-box"
            }}>
              <img
                src={import.meta.env.VITE_LOGO_URL || "/logo.jpg"}
                alt="Logo"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
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
              <div className="sad-logo-text">WorkStockPro</div>
              <div className="sad-logo-sub">Super Admin</div>
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
            style={{ position: "relative" }}
          >
            <MessageSquare size={18} /> Request Panel
            {pendingRequestCount > 0 && (
              <span style={{
                marginLeft: "auto",
                background: "#ef4444",
                color: "#fff",
                fontSize: 10,
                fontWeight: 800,
                borderRadius: 20,
                padding: "1px 6px",
                minWidth: 18,
                textAlign: "center",
                lineHeight: "16px",
              }}>
                {pendingRequestCount > 99 ? "99+" : pendingRequestCount}
              </span>
            )}
          </div>

          <div
            className={`sad-nav-item ${activeView === "control-panel" ? "sad-active" : ""}`}
            onClick={() => setActiveView("control-panel")}
          >
            <Shield size={18} /> Control Panel
          </div>

          <div
            className={`sad-nav-item ${activeView === "directory" ? "sad-active" : ""}`}
            onClick={() => { setDirectoryFilter(null); setActiveView("directory"); }}
          >
            <Users size={18} /> Directory
          </div>

          {/* <div
            className={`sad-nav-item ${activeView === "permissions" ? "sad-active" : ""}`}
            onClick={() => setActiveView("permissions")}
          >
            <Shield size={18} /> User Permissions
          </div> */}

          {/* ── WorkStockPro Sidebar Item ── */}
          <div
            className={`sad-nav-item ${activeView === "workstockpro" ? "sad-active" : ""}`}
            onClick={() => setActiveView("workstockpro")}
          >
            <Package size={18} /> WorkStockPro
          </div>

        </nav>
        <div className="sad-sidebar-footer">
          <button
            className="sad-logout"
            onClick={() => { sessionStorage.clear(); navigate("/login", { replace: true }); }}
          >
            <LogOut size={15} /> Logout
          </button>
        </div>
      </aside>

      <div className="sad-main">
        
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

            {(() => {
              let pic = user?.profilePic || user?.profile_pic;
              if (pic && pic.startsWith("/uploads")) {
                pic = `${API_URL}${pic}`;
              }
              return (
                <div className="sad-profile-pill" onClick={() => navigate("/settings")}>
                  {pic ? (
                    <img src={pic} alt="Avatar" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div className="sad-avatar">{initials(user?.fullname)}</div>
                  )}
                  <span className="sad-avatar-name">{user?.fullname || "Super Admin"}</span>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="sad-content">

          {activeView === "request-panel" ? (
            <RequestPanelContent role="super_admin" />
          ) : activeView === "leaves" ? (
            <AdminLeaveManagement />
          ) : activeView === "directory" ? (
            <div>
              {directoryFilter && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <button
                    onClick={() => { setDirectoryFilter(null); setActiveView("directory"); }}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    ← Back to All
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#4f46e5", background: "#eef2ff", borderRadius: 8, padding: "4px 12px", textTransform: "capitalize" }}>
                    Showing: {directoryFilter === "present" ? "Present Today" : `${directoryFilter}s`}
                  </span>
                </div>
              )}
              <DirectoryPanel filterRole={directoryFilter} />
            </div>
          ) : activeView === "dpr" ? (
            <AdminDPR />
          ) : activeView === "control-panel" ? (
            <ControlPanel />
          ) : activeView === "workstockpro" ? (
            // ── WorkStockPro inline view ──
            <div style={{ padding: "24px", animation: "cpFadeIn 0.4s ease-out" }}>
              <div style={{ display: "none" }}></div>
              <iframe
                src={workstockUrl}
                style={{
                  width: "100%",
                  height: "82vh",
                  border: "none",
                  borderRadius: "12px",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.08)"
                }}
                title="WorkStockPro"
                allow="same-origin"
              />
            </div>
          ) : null}

          {activeView === "dashboard" && (
            <>
              <div className="sad-stats-row">
                <div className="sad-stat-card sad-teal" style={{ cursor: "pointer" }} onClick={() => { setDirectoryFilter("employee"); setActiveView("directory"); }}>
                  <div className="sad-stat-badge">Team</div>
                  <div className="sad-stat-icon"><Users size={24} /></div>
                  <div className="sad-stat-number">{stats.totalEmployees}</div>
                  <div className="sad-stat-label">Employees</div>
                </div>

                <div className="sad-stat-card sad-blue" style={{ cursor: "pointer" }} onClick={() => { setDirectoryFilter("intern"); setActiveView("directory"); }}>
                  <div className="sad-stat-badge">Team</div>
                  <div className="sad-stat-icon"><UserPlus size={24} /></div>
                  <div className="sad-stat-number">{stats.totalInterns}</div>
                  <div className="sad-stat-label">Interns</div>
                </div>

                <div className="sad-stat-card sad-green" style={{ cursor: "pointer" }} onClick={() => { setDirectoryFilter("admin"); setActiveView("directory"); }}>
                  <div className="sad-stat-badge">Staff</div>
                  <div className="sad-stat-icon"><Shield size={24} /></div>
                  <div className="sad-stat-number">{stats.totalAdmins}</div>
                  <div className="sad-stat-label">Admins</div>
                </div>

                <div className="sad-stat-card sad-purple" style={{ cursor: "pointer" }} onClick={() => { setDirectoryFilter("present"); setActiveView("directory"); }}>
                  <div className="sad-stat-badge">Today</div>
                  <div className="sad-stat-icon"><Calendar size={24} /></div>
                  <div className="sad-stat-number">{stats.presentToday}</div>
                  <div className="sad-stat-label">Present Today</div>
                </div>
              </div>

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

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginTop: "24px" }}>
                {[
                  { label: "Enroll Member", desc: "Add new Admin/Employee", icon: <UserPlus size={22} />, color: "#6366f1", bg: "#eef2ff", action: () => setShowCreateUser(true) },
                  { label: "Upload Attendance", desc: "Excel or Google Drive", icon: <FileSpreadsheet size={22} />, color: "#f59e0b", bg: "#fffbeb", action: () => setShowUpload(true) },
                  { label: "Leave Management", desc: "Approve / Track Leaves", icon: <CalendarCheck size={22} />, color: "#10b981", bg: "#ecfdf5", action: () => setShowLeaveManagement(true) },
                  { label: "Tasks", desc: "Manage assignments", icon: <ClipboardList size={22} />, color: "#6366f1", bg: "#eef2ff", action: () => setShowTaskModal(true) },
                  { label: "Certificate Requests", desc: "Approve employee requests", icon: <Download size={22} />, color: "#f59e0b", bg: "#fffbeb", action: () => setActiveView("request-panel") },
                  { label: "Payroll", desc: "Generate payslips", icon: <Banknote size={22} />, color: "#f59e0b", bg: "#fffbeb", action: () => setShowPayslip(true) },
                  { label: "Reports", desc: "Export attendance data", icon: <ClipboardCheck size={22} />, color: "#10b981", bg: "#ecfdf5", action: () => setShowDownloadModal(true) },
                  { label: "DPR Overview", desc: "Review daily progress", icon: <MessageSquare size={22} />, color: "#8b5cf6", bg: "#f5f3ff", action: () => setActiveView("dpr") },
                  { label: "Meetings", desc: "Meeting Calendar", icon: <Calendar size={22} />, color: "#3b82f6", bg: "#eff6ff", action: () => setShowMeeting(true) },
                  { label: "Departments", desc: "Manage Departments", icon: <Building2 size={22} />, color: "#4f46e5", bg: "#eef2ff", action: () => setShowDepartments(true) }
                ].map((item) => (
                  <div
                    key={item.label}
                    onClick={item.action}
                    style={{
                      display: "flex", alignItems: "center", gap: "14px",
                      background: "#fff", border: "1px solid #e8ecf0",
                      borderRadius: "12px", padding: "18px 20px", cursor: "pointer",
                      transition: "box-shadow 0.18s, border-color 0.18s, transform 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(99,102,241,0.10)"; e.currentTarget.style.borderColor = "#c7d2fe"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "#e8ecf0"; e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: item.bg, color: item.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 3 }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

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
                <div className="sad-section-title" style={{ marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Incoming Requests</span>
                  {pendingRequestCount > 0 && (
                    <span style={{ background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 20, padding: "2px 8px" }}>
                      {pendingRequestCount} pending
                    </span>
                  )}
                </div>
                {pendingRequests.length === 0 ? (
                  <div className="sad-placeholder-text" style={{ fontSize: "12px", color: "#94a3b8" }}>No requests yet.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {pendingRequests.filter(r => r.status === "pending").slice(0, 3).map((req, i) => (
                      <div key={req.id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#fef9f0", borderRadius: 8, border: "1px solid #fde68a" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {req.name || req.certificate_name || "Request"}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>
                            {req.employee_name || "Employee"}{req.request_type ? ` · ${req.request_type}` : ""}
                          </div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 6, background: "#fef3c7", color: "#92400e", flexShrink: 0, marginLeft: 8 }}>Pending</span>
                      </div>
                    ))}
                    {pendingRequestCount > 3 && (
                      <div style={{ fontSize: 11, color: "#4f46e5", fontWeight: 700, textAlign: "center", paddingTop: 4 }}>
                        +{pendingRequestCount - 3} more · click to view all
                      </div>
                    )}
                    {pendingRequestCount === 0 && pendingRequests.length > 0 && (
                      <div style={{ fontSize: 12, color: "#64748b" }}>All requests resolved. Click to view history.</div>
                    )}
                  </div>
                )}
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
            <button className="sad-modal-close" onClick={() => setShowLeaveManagement(false)}>✕</button>
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

      {showPayslip && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content" style={{ width: "95%", maxWidth: "1200px" }}>
            <button className="sad-modal-close" onClick={() => setShowPayslip(false)}>✕</button>
            <PayslipGeneration />
          </div>
        </div>
      )}

      {showMeeting && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content" style={{ width: "95%", maxWidth: "1200px", padding: "0" }}>
            <MeetingCalendar onClose={() => setShowMeeting(false)} />
          </div>
        </div>
      )}

      {showDepartments && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content" style={{ width: "95%", maxWidth: "800px" }}>
            <button className="sad-modal-close" onClick={() => setShowDepartments(false)}>✕</button>
            <Departments />
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
                  const token = sessionStorage.getItem("token");
                  const res = await api.get(
                    `/attendance/export-excel?from=${fromDate}&to=${toDate}`,
                    { responseType: "blob" }
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