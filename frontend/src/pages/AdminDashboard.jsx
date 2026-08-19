import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, API_URL } from "../utils/api";

import {
  Users, LogOut, UserPlus,
  Calendar, Download, FileSpreadsheet,
  ClipboardCheck, LayoutDashboard, MessageSquare, Bell, Shield, CalendarCheck, Banknote, ClipboardList, Package, Plane,
  ArrowDownToLine, ArrowUpFromLine, List, FileBarChart
} from "lucide-react";
import AttendanceRecords from "./AttendanceRecords";
import BulkAttendance from "./BulkAttendance";
import AdminLeaveManagement from "./AdminLeaveManagement";
import AdminApplyLeave from "./AdminApplyLeave";
import TaskManagement from "./TaskManagement";
import PayslipGeneration from "./PayslipGeneration";
import AdminDPR from "./AdminDPR";
import CreateUser from "./CreateUser";
import ControlPanel from "./ControlPanel";
import MeetingCalendar from "./MeetingCalendar";

import AttendanceUpload from "./AttendanceUpload";
import RequestPanelContent from "../components/RequestPanelContent";
import DirectoryPanel from "./DirectoryPanel";
import Departments from "./Departments";

import "../styles/AdminDashboard.css";
import "../styles/EmployeeDashboard.css";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("user"));
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
  const [permsLoaded, setPermsLoaded] = useState(false);
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
  const [showMeeting, setShowMeeting] = useState(false);

  const [showBulletinModal, setShowBulletinModal] = useState(false);
  const [bulletinTitle, setBulletinTitle] = useState("");
  const [bulletinContent, setBulletinContent] = useState("");
  const [bulletinPosting, setBulletinPosting] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(true);
  const notifRef = useRef(null);

  const [pendingRequests, setPendingRequests] = useState([]);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const pendingRequestCount = pendingRequests.filter(r => r.status === "pending").length;

  const todayStr = new Date().toISOString().split("T")[0];
  const firstOfMonth = todayStr.slice(0, 7) + "-01";
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(todayStr);

  const todayNotifs = notifications.filter(n => n.created_at && n.created_at.startsWith(todayStr));

  // ── Poll sessionStorage until permissions are populated by DashboardSwitcher ──
  // DashboardSwitcher does a background /auth/me + /permissions/my and writes to sessionStorage.
  // We poll every 300ms so AdminDashboard picks up permissions as soon as they land,
  // instead of reading once at mount time when they may not be there yet.
  useEffect(() => {
    const tryLoad = () => {
      try {
        const latest = JSON.parse(sessionStorage.getItem("user") || "{}");
        if (Array.isArray(latest.permissions) && latest.permissions.length > 0) {
          const permMap = {};
          latest.permissions.forEach(p => {
            permMap[p.feature_name] = { can_read: p.can_read, can_write: p.can_write };
          });
          setPerms(permMap);
          setUser(latest);
          setPermsLoaded(true);
          return true; // signal: done
        }
      } catch { /* ignore */ }
      return false;
    };

    // Try immediately in case permissions are already in sessionStorage
    if (tryLoad()) return;

    const interval = setInterval(() => {
      if (tryLoad()) {
        clearInterval(interval);
        clearTimeout(timeout);
      }
    }, 300);

    // Give up after 10s — mark loaded so UI isn't blocked forever
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setPermsLoaded(true);
    }, 10000);

    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, []);

  // ── Fetch notifications separately (network only, not cached) ──
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const notifRes = await api.get("/notifications/my");
        setNotifications(Array.isArray(notifRes.data) ? notifRes.data : []);
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

  const fetchDashboardData = useCallback(async () => {
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
        presentToday: statsRes.data.presentToday !== undefined ? statsRes.data.presentToday : (attendanceRes.data.presentToday || 0),
      });
      setBulletins(bulletinsRes.data);
      setPendingRequests(Array.isArray(reqRes.data) ? reqRes.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // navigate is stable — removing it from deps prevents infinite re-fetch loop

  useEffect(() => {
    if (!sessionStorage.getItem("token") || !sessionStorage.getItem("user")) {
      navigate("/login");
      return;
    }
    fetchDashboardData();
  // fetchDashboardData is stable (no deps), navigate is stable — safe to list both once
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePostBulletin = async () => {
    if (!bulletinContent.trim()) return;
    setBulletinPosting(true);
    try {
      await api.post("/bulletins",
        { title: bulletinTitle || "Bulletin", content: bulletinContent }
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
  if (!permsLoaded) return <div className="stdc-loading">Loading permissions…</div>;

  const pendingCount = stats.totalEmployees - stats.presentToday;
  const initials = (name = "") => name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const isSuperAdmin = user?.role?.toLowerCase() === "super_admin";

  // ── WorkStockPro base URL ──
  const workstockToken = sessionStorage.getItem("token");
  const wsBase = import.meta.env.VITE_WORKSTOCK_URL || `http://${window.location.hostname}:3001`;
  // Keep old workstockUrl for backward compat on this component
  const workstockUrl = `${wsBase}?token=${workstockToken}`;

  // ── Permission helpers ──────────────────────────────────────────────────────
  // IMPORTANT: Only fall back to role-based default if NO permission record
  // exists at all for this feature (i.e. super_admin only). Regular admins
  // must have an explicit can_read=true record to access a feature.
  const canRead = (feature) => {
    if (isSuperAdmin) return true;
    if (perms[feature] !== undefined) return perms[feature].can_read === true;
    // No record exists → deny by default for regular admins
    return false;
  };

  const canWrite = (feature) => {
    if (isSuperAdmin) return true;
    if (perms[feature] !== undefined) return perms[feature].can_write === true;
    // No record exists → deny by default for regular admins
    return false;
  };

  // Build comma-separated SMS permissions string
  const buildSmsPerms = () => {
    const smsFeatures = ["workstockpro", "sms_stock_in", "sms_withdrawal", "sms_master_list", "sms_reports"];
    if (isSuperAdmin) return smsFeatures.join(",");
    return smsFeatures.filter(f => canRead(f)).join(",");
  };

  const buildSmsWritePerms = () => {
    const smsFeatures = ["workstockpro", "sms_stock_in", "sms_withdrawal", "sms_master_list", "sms_reports"];
    if (isSuperAdmin) return smsFeatures.join(",");
    return smsFeatures.filter(f => canWrite(f)).join(",");
  };

  // Build WorkStock iframe URL for a given sub-path and feature
  const wsUrl = (path = "", feature = activeView) => {
    const urlPath = path ? `/${path}` : "";
    const isReadOnly = !canWrite(feature);
    return `${wsBase}${urlPath}?token=${workstockToken}&sms_perms=${encodeURIComponent(buildSmsPerms())}&sms_write_perms=${encodeURIComponent(buildSmsWritePerms())}&read_only=${isReadOnly}`;
  };
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="stdc-shell">

      {/* ── Sidebar ── */}
      <aside className="stdc-sidebar">
        <div className="stdc-logo-area">
          <div className="stdc-logo-mark">
            <div style={{
              width: 72, height: 72,
              background: "#ffffff",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
              boxShadow: "0 2px 10px rgba(0,0,0,0.2)"
            }}>
              <img
                src={import.meta.env.VITE_LOGO_URL || "/logo.jpg"}
                alt="Logo"
                style={{ width: 64, height: 64, objectFit: "contain" }}
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
              <div className="stdc-logo-text">WorkStockPro</div>
              <div className="stdc-logo-sub" title={user?.department || "Admin Portal"}>{user?.department || "Admin Portal"}</div>
            </div>
          </div>
        </div>

        <nav className="stdc-nav">
          <div className="stdc-nav-label">Main</div>

          {/* Dashboard — always visible */}
          <div
            className={`stdc-nav-item ${activeView === "dashboard" ? "stdc-nav-active" : ""}`}
            onClick={() => setActiveView("dashboard")}
          >
            <LayoutDashboard size={18} /> Dashboard
          </div>

          {/* Request Panel — permission gated */}
          {canRead("request_panel") && (
            <div
              className={`stdc-nav-item ${activeView === "request-panel" ? "stdc-nav-active" : ""}`}
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
          )}

          {/* Leave Management — permission gated */}
          {canRead("leaves") && (
            <div
              className={`stdc-nav-item ${activeView === "leaves" ? "stdc-nav-active" : ""}`}
              onClick={() => setActiveView("leaves")}
            >
              <ClipboardCheck size={18} /> Leave Management
            </div>
          )}

          {/* My Leave — always visible (personal) */}
          <div
            className={`stdc-nav-item ${activeView === "my-leave" ? "stdc-nav-active" : ""}`}
            onClick={() => setActiveView("my-leave")}
          >
            <Plane size={18} /> My Leave
          </div>

          {/* Directory — permission gated */}
          {canRead("directory") && (
            <div
              className={`stdc-nav-item ${activeView === "directory" ? "stdc-nav-active" : ""}`}
              onClick={() => setActiveView("directory")}
            >
              <Users size={18} /> Directory
            </div>
          )}

          {/* DPR Overview — permission gated */}
          {canRead("dpr") && (
            <div
              className={`stdc-nav-item ${activeView === "dpr" ? "stdc-nav-active" : ""}`}
              onClick={() => setActiveView("dpr")}
            >
              <ClipboardList size={18} /> DPR Overview
            </div>
          )}

          {/* WorkStock Pro — SMS dashboard, permission gated */}
          {(canRead("workstockpro") || canRead("sms_stock_in") || canRead("sms_withdrawal") || canRead("sms_master_list") || canRead("sms_reports")) && (
            <>
              <div className="stdc-nav-label" style={{ marginTop: 10 }}>Stock (SMS)</div>
              
              {canRead("workstockpro") && (
                <div
                  className={`stdc-nav-item ${activeView === "workstockpro" ? "stdc-nav-active" : ""}`}
                  onClick={() => setActiveView("workstockpro")}
                >
                  <Package size={18} /> SMS Dashboard
                </div>
              )}
              
              {canRead("sms_stock_in") && (
                <div
                  className={`stdc-nav-item ${activeView === "sms_stock_in" ? "stdc-nav-active" : ""}`}
                  onClick={() => setActiveView("sms_stock_in")}
                >
                  <ArrowDownToLine size={18} /> Stock In
                </div>
              )}
              
              {canRead("sms_withdrawal") && (
                <div
                  className={`stdc-nav-item ${activeView === "sms_withdrawal" ? "stdc-nav-active" : ""}`}
                  onClick={() => setActiveView("sms_withdrawal")}
                >
                  <ArrowUpFromLine size={18} /> Withdrawal
                </div>
              )}
              
              {canRead("sms_master_list") && (
                <div
                  className={`stdc-nav-item ${activeView === "sms_master_list" ? "stdc-nav-active" : ""}`}
                  onClick={() => setActiveView("sms_master_list")}
                >
                  <List size={18} /> Master List
                </div>
              )}
              
              {canRead("sms_reports") && (
                <div
                  className={`stdc-nav-item ${activeView === "sms_reports" ? "stdc-nav-active" : ""}`}
                  onClick={() => setActiveView("sms_reports")}
                >
                  <FileBarChart size={18} /> All Withdrawals
                </div>
              )}
            </>
          )}

          {/* Control Panel — super admin only */}
          {isSuperAdmin && (
          <div
            className={`stdc-nav-item ${activeView === "control-panel" ? "stdc-nav-active" : ""}`}
            onClick={() => setActiveView("control-panel")}
          >
            <Shield size={18} /> Control Panel
          </div>
          )}
        </nav>

        <div className="stdc-sidebar-footer">
          <button
            className="stdc-logout-btn"
            onClick={() => { sessionStorage.clear(); navigate("/login", { replace: true }); }}
          >
            <LogOut size={15} /> Logout
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="stdc-main">

        <div className="stdc-topbar">
          <div className="stdc-topbar-left">
            <div className="stdc-page-title">
              {user?.department ? `${user.department} Dashboard` : "Admin Dashboard"}
            </div>
          </div>

          <div style={{ flex: 1 }}></div>

          <div className="stdc-topbar-right">
            {canWrite("bulletins") && (
              <button 
                onClick={() => setShowBulletinModal(true)}
                style={{ padding: "6px 14px", height: "34px", display: "flex", alignItems: "center", marginRight: "8px", border: "none", color: "#fff", background: "#4f46e5", borderRadius: "8px", fontWeight: "600", cursor: "pointer", fontSize: "13px" }}
              >
                + New Bulletin
              </button>
            )}
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

            {(() => {
              let pic = user?.profilePic || user?.profile_pic;
              if (pic && pic.startsWith("/uploads")) {
                pic = `${API_URL}${pic}`;
              }
              return (
                <div className="stdc-avatar-pill" onClick={() => navigate("/settings")}>
                  {pic ? (
                    <img src={pic} alt="Avatar" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div className="stdc-avatar">{initials(user?.fullname || (user?.department ? `${user.department} Admin` : "Admin"))}</div>
                  )}
                  <span className="stdc-avatar-name">{user?.fullname || (user?.department ? `${user.department} Admin` : "Admin")}</span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── Views ── */}
        <div className="stdc-content">

          {activeView === "request-panel" && canRead("request_panel") ? (
            <RequestPanelContent role={user?.role || "admin"} />
          ) : activeView === "my-leave" ? (
            <AdminApplyLeave />
          ) : activeView === "leaves" && canRead("leaves") ? (
            <AdminLeaveManagement readOnly={!canWrite("leaves")} />
          ) : activeView === "directory" && canRead("directory") ? (
            <DirectoryPanel />
          ) : activeView === "dpr" && canRead("dpr") ? (
            <AdminDPR readOnly={!canWrite("dpr")} />
          ) : activeView === "departments" && canRead("departments") ? (
            <Departments />
          ) : activeView === "workstockpro" || activeView === "sms_stock_in" || activeView === "sms_withdrawal" || activeView === "sms_master_list" || activeView === "sms_reports" ? (
            <div style={{ padding: "24px", animation: "cpFadeIn 0.4s ease-out" }}>
              <div style={{ display: "none" }}></div>
              <iframe
                src={wsUrl(
                  activeView === "sms_master_list" ? "products" :
                  activeView === "sms_withdrawal" ? "withdraw" :
                  activeView === "sms_stock_in" ? "add-product" :
                  activeView === "sms_reports" ? "my-withdrawals" : ""
                )}
                style={{ width: "100%", height: "82vh", border: "none", borderRadius: "12px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
                title="WorkStockPro"
                allow="same-origin"
              />
            </div>
          ) : activeView === "control-panel" ? (
            <ControlPanel />
          ) : activeView === "dashboard" ? (
            <>
              {/* ── Stats row ── */}
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

              {/* ── Attendance banner — only shown if user can read attendance ── */}
              {canRead("attendance") && (
                <div className="stdc-attendance-banner">
                  <div className="stdc-banner-left">
                    <h2>Today's Attendance</h2>
                    <p>Mark and track attendance for all employees</p>
                    {canWrite("attendance") && (
                      <button className="stdc-post-attendance-btn" onClick={() => setShowBulk(true)}>
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

              {/* ── Quick Actions ── */}
              <div className="stdc-section-header">
                <div className="stdc-section-title">Quick Actions</div>
              </div>

              <div className="stdc-actions-grid">

                {/* Enroll Member */}
                {canRead("enroll") && (
                  <div className="stdc-action-card" onClick={() => setShowCreateUser(true)}>
                    <div className="stdc-action-icon"><UserPlus size={20} /></div>
                    <div>
                      <div className="stdc-action-label">Enroll Member</div>
                      <div className="stdc-action-desc">Onboard new staff</div>
                    </div>
                  </div>
                )}

                {/* Upload Attendance */}
                {canRead("upload_attendance") && (
                  <div className="stdc-action-card" onClick={() => setShowUpload(true)}>
                    <div className="stdc-action-icon"><FileSpreadsheet size={20} /></div>
                    <div>
                      <div className="stdc-action-label">Upload Attendance</div>
                      <div className="stdc-action-desc">Excel or Google Drive</div>
                    </div>
                  </div>
                )}

                {/* Leave Management */}
                {canRead("leaves") && (
                  <div className="stdc-action-card" onClick={() => setShowLeaveManagement(true)}>
                    <div className="stdc-action-icon"><ClipboardCheck size={20} /></div>
                    <div>
                      <div className="stdc-action-label">Leave Management</div>
                      <div className="stdc-action-desc">Approve / Track Leaves</div>
                    </div>
                  </div>
                )}

                {/* My Leave — always visible */}
                <div className="stdc-action-card" onClick={() => setActiveView("my-leave")}>
                  <div className="stdc-action-icon"><Plane size={20} /></div>
                  <div>
                    <div className="stdc-action-label">My Leave</div>
                    <div className="stdc-action-desc">Apply or view your leaves</div>
                  </div>
                </div>

                {/* Tasks */}
                {canRead("tasks") && (
                  <div className="stdc-action-card" onClick={() => setShowTaskModal(true)}>
                    <div className="stdc-action-icon"><ClipboardList size={20} /></div>
                    <div>
                      <div className="stdc-action-label">Tasks</div>
                      <div className="stdc-action-desc">Manage assignments</div>
                    </div>
                  </div>
                )}

                {/* Certificate Requests — uses payslips write permission (same as ControlPanel) */}
                {canWrite("payslips") && (
                  <div className="stdc-action-card" onClick={() => navigate("/payslip-approvals")}>
                    <div className="stdc-action-icon"><FileSpreadsheet size={20} /></div>
                    <div>
                      <div className="stdc-action-label">Certificate Requests</div>
                      <div className="stdc-action-desc">Approve employee requests</div>
                    </div>
                  </div>
                )}

                {/* Departments */}
                {canRead("departments") && (
                  <div className="stdc-action-card" onClick={() => setActiveView("departments")}>
                    <div className="stdc-action-icon"><LayoutDashboard size={20} /></div>
                    <div>
                      <div className="stdc-action-label">Departments</div>
                      <div className="stdc-action-desc">Manage departments</div>
                    </div>
                  </div>
                )}

                {/* Payroll */}
                {canRead("payslips") && (
                  <div className="stdc-action-card" onClick={() => setShowPayslip(true)}>
                    <div className="stdc-action-icon"><Banknote size={20} /></div>
                    <div>
                      <div className="stdc-action-label">Payroll</div>
                      <div className="stdc-action-desc">Generate payslips</div>
                    </div>
                  </div>
                )}

                {/* Attendance Records */}
                {canRead("attendance_records") && (
                  <div className="stdc-action-card" onClick={() => setShowAttRecords(true)}>
                    <div className="stdc-action-icon"><CalendarCheck size={20} /></div>
                    <div>
                      <div className="stdc-action-label">Attendance Records</div>
                      <div className="stdc-action-desc">View daily records</div>
                    </div>
                  </div>
                )}

                {/* Reports */}
                {canWrite("attendance_reports") && (
                  <div className="stdc-action-card" onClick={() => setShowDownloadModal(true)}>
                    <div className="stdc-action-icon"><FileSpreadsheet size={20} /></div>
                    <div>
                      <div className="stdc-action-label">Reports</div>
                      <div className="stdc-action-desc">Export attendance data</div>
                    </div>
                  </div>
                )}

                {/* DPR Overview */}
                {canRead("dpr") && (
                  <div className="stdc-action-card" onClick={() => setActiveView("dpr")}>
                    <div className="stdc-action-icon"><ClipboardList size={20} /></div>
                    <div>
                      <div className="stdc-action-label">DPR Overview</div>
                      <div className="stdc-action-desc">Review daily progress</div>
                    </div>
                  </div>
                )}

                {/* Meetings */}
                {canRead("meetings") && (
                  <div className="stdc-action-card" onClick={() => setShowMeeting(true)}>
                    <div className="stdc-action-icon"><Calendar size={20} /></div>
                    <div>
                      <div className="stdc-action-label">Meetings</div>
                      <div className="stdc-action-desc">Meeting Calendar</div>
                    </div>
                  </div>
                )}



              </div>
            </>
          ) : null}

          {/* ── Bottom row: Bulletins / Requests / Notifications ── */}
          {(activeView === "dashboard" || activeView === "control-panel" || activeView === "leaves" || activeView === "directory" || activeView === "request-panel" || activeView === "dpr" || activeView === "departments") && (
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

              {canRead("request_panel") && (
                <div className="stdc-bottom-card" onClick={() => setActiveView("request-panel")} style={{ cursor: "pointer" }}>
                  <div className="stdc-bottom-card-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>Incoming Requests</span>
                    {pendingRequestCount > 0 && (
                      <span style={{ background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 20, padding: "2px 8px" }}>
                        {pendingRequestCount} pending
                      </span>
                    )}
                  </div>
                  {pendingRequests.length === 0 ? (
                    <div className="stdc-empty-text" style={{ fontSize: "12px", color: "#94a3b8", marginTop: 8 }}>No requests yet.</div>
                  ) : (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
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
              )}

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

      {/* ── Modals ── */}

      {showUpload && (
        <div className="stdc-overlay">
          <div className="stdc-modal-box" style={{ maxWidth: "520px" }}>
            <button className="stdc-modal-close-btn" onClick={() => setShowUpload(false)}>✕</button>
            <AttendanceUpload readOnly={!canWrite("upload_attendance")} />
          </div>
        </div>
      )}

      {showLeaveManagement && (
        <div className="stdc-overlay">
          <div className="stdc-modal-box" style={{ width: "95%", maxWidth: "1200px" }}>
            <button className="stdc-modal-close-btn" onClick={() => setShowLeaveManagement(false)}>✕</button>
            <AdminLeaveManagement readOnly={!canWrite("leaves")} />
          </div>
        </div>
      )}

      {showBulk && (
        <div className="stdc-overlay">
          <div className="stdc-modal-box">
            <button className="stdc-modal-close-btn" onClick={() => setShowBulk(false)}>✕</button>
            <BulkAttendance readOnly={!canWrite("attendance")} />
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
          <div className="stdc-modal-box" style={{ width: "95%", maxWidth: "1100px" }}>
            <button className="stdc-modal-close-btn" onClick={() => setShowTaskModal(false)}>✕</button>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 24px" }}>
              <TaskManagement readOnly={!canWrite("tasks")} />
            </div>
          </div>
        </div>
      )}

      {showPayslip && (
        <div className="stdc-overlay">
          <div className="stdc-modal-box" style={{ maxWidth: "1000px" }}>
            <button className="stdc-modal-close-btn" onClick={() => setShowPayslip(false)}>✕</button>
            <PayslipGeneration readOnly={!canWrite("payslips")} />
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
                  readOnly={!canWrite("enroll")}
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

      {showMeeting && (
        <div className="stdc-overlay">
          <div className="stdc-modal-box" style={{ width: "95%", maxWidth: "1200px", padding: 0 }}>
            <MeetingCalendar onClose={() => setShowMeeting(false)} readOnly={!canWrite("meetings")} />
          </div>
        </div>
      )}

      {showBulletinModal && (
        <div className="stdc-overlay">
          <div className="stdc-modal-box" style={{ maxWidth: "480px", padding: "28px" }}>
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