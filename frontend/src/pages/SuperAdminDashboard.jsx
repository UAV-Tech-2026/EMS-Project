import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import {
  Users, BarChart3, LogOut, UserPlus,
  Calendar, Bell, Download, ClipboardList,
  FileSpreadsheet, Banknote, CheckSquare,
  LayoutDashboard, GitBranch, ClipboardCheck
} from "lucide-react";
import AttendanceRecords from "./AttendanceRecords";
import DirectoryPanel    from "./DirectoryPanel";
import TaskManagement    from "./TaskManagement";
import BulkAttendance    from "./BulkAttendance";
import SuperAdminProfile from "./SuperAdminProfile";
import PayslipGeneration from "./PayslipGeneration";
import AttendanceUpload  from "./AttendanceUpload";
import "../styles/SuperAdminDashboard.css";

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  const [stats, setStats] = useState({
    totalUsers:      0,
    totalEmployees:  0,
    activeEmployees: 0,
    presentToday:    0,
  });

  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);

  const [showBulk,         setShowBulk]         = useState(false);
  const [showTaskModal,    setShowTaskModal]    = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showDownloadModal,setShowDownloadModal]= useState(false);
  const [showPayslip,      setShowPayslip]      = useState(false);
  const [showDirectory,    setShowDirectory]    = useState(false);
  const [showUpload,       setShowUpload]       = useState(false);
  const [showAttRecords, setShowAttRecords] = useState(false);

  const todayStr      = new Date().toISOString().split("T")[0];
  const firstOfMonth  = todayStr.slice(0, 7) + "-01";
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate,   setToDate]   = useState(todayStr);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return navigate("/login");
        const headers = { Authorization: `Bearer ${token}` };

        const [statsRes, logsRes, attendanceRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/employees/stats`,            { headers }),
          axios.get(`${import.meta.env.VITE_API_URL}/employees/recent`,           { headers }),
          axios.get(`${import.meta.env.VITE_API_URL}/employees/attendance-today`, { headers }),
        ]);

        setStats({
          totalUsers:      statsRes.data.totalUsers,
          totalEmployees:  statsRes.data.totalEmployees,
          activeEmployees: statsRes.data.activeEmployees || 0,
          presentToday:    attendanceRes.data.presentToday || 0,
        });
        setLogs(logsRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [navigate]);

  if (!user)    return <div className="sad-loading">Authenticating…</div>;
  if (loading)  return <div className="sad-loading">Loading dashboard…</div>;

  const pendingCount = stats.totalEmployees - stats.presentToday;
  const initials     = (name = "") => name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="sad-shell">

      {/* ── SIDEBAR ── */}
      <aside className="sad-sidebar">
        <div className="sad-logo-area">
          <div className="sad-logo-mark">
            <div className="sad-logo-icon">UAV</div>
            <div>
              <div className="sad-logo-text">UAV Tech</div>
              <div className="sad-logo-sub">Super Admin</div>
            </div>
          </div>
        </div>

        <nav className="sad-nav">
          <div className="sad-nav-label">Main</div>

          <div className="sad-nav-item sad-active">
            <LayoutDashboard size={15} /> Dashboard
          </div>

          

          <div className="sad-nav-item" onClick={() => navigate("/create-user")}>
            <UserPlus size={15} /> Create User
          </div>

          <div className="sad-nav-label">Tools</div>

          <div className="sad-nav-item" onClick={() => setShowDirectory(true)}>
            <Users size={15} /> Directory
          </div>

          <div className="sad-nav-item" onClick={() => setShowBulk(true)}>
            <ClipboardCheck size={15} /> Attendance
          </div>

          <div className="sad-nav-item" onClick={() => setShowUpload(true)}>
            <FileSpreadsheet size={15} /> Upload Attendance
          </div>

          <div className="sad-nav-item" onClick={() => setShowTaskModal(true)}>
            <ClipboardList size={15} /> Tasks
          </div>
          <div className="sad-nav-item" onClick={() => setShowAttRecords(true)}>
  <ClipboardCheck />
  <h4>View Attendance</h4>
</div>

          <div className="sad-nav-item" onClick={() => setShowDownloadModal(true)}>
            <Download size={15} /> Export Data
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
          <div>
            <div className="sad-page-title">Dashboard</div>
            <div className="sad-page-breadcrumb">
              Welcome back, <strong>{user?.fullname}</strong>
            </div>
          </div>
          <div className="sad-topbar-right">
            <div className="sad-date-chip">
              {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </div>
            <div
              className="sad-profile-pill"
              onClick={() => setShowProfileModal(true)}
            >
              <div className="sad-avatar">{initials(user?.fullname)}</div>
              <div>
                <div className="sad-avatar-name">{user?.fullname}</div>
                <div className="sad-avatar-role">Super Admin</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="sad-content">

          {/* ── Stat cards ── */}
          <div className="sad-stats-row">
            <div className="sad-stat-card sad-teal">
              <div className="sad-stat-badge">Users</div>
              <div className="sad-stat-icon"><Users size={20} /></div>
              <div className="sad-stat-number">{stats.totalEmployees}</div>
              <div className="sad-nav-item" onClick={() => setShowDirectory(true)}>
            <Users size={15} /> Directory
          </div>
            </div>

            <div className="sad-stat-card sad-blue">
              <div className="sad-stat-badge">Users</div>
              <div className="sad-stat-icon"><BarChart3 size={20} /></div>
              <div className="sad-stat-number">{stats.totalUsers}</div>
              <div className="sad-stat-label">Total Users</div>
            </div>

            <div className="sad-stat-card sad-green">
              <div className="sad-stat-badge">Live</div>
              <div className="sad-stat-icon"><CheckSquare size={20} /></div>
              <div className="sad-stat-number">{stats.activeEmployees}</div>
              <div className="sad-stat-label">Active</div>
            </div>

            <div className="sad-stat-card sad-purple">
              <div className="sad-stat-badge">Today</div>
              <div className="sad-stat-icon"><Calendar size={20} /></div>
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

            <div className="sad-action-card sad-ac-enroll" onClick={() => navigate("/create-user")}>
              <div className="sad-action-icon"><UserPlus size={20} /></div>
              <div>
                <div className="sad-action-name">Enroll Employee</div>
                <div className="sad-action-desc">Add new member</div>
              </div>
            </div>

            <div className="sad-action-card sad-ac-dl" onClick={() => setShowUpload(true)}>
              <div className="sad-action-icon"><FileSpreadsheet size={20} /></div>
              <div>
                <div className="sad-action-name">Upload Attendance</div>
                <div className="sad-action-desc">Excel or Google Drive</div>
              </div>
            </div>

            <div className="sad-action-card sad-ac-enroll" onClick={() => setShowDirectory(true)}>
              <div className="sad-action-icon"><Users size={20} /></div>
              <div>
                <div className="sad-action-name">Directory</div>
                <div className="sad-action-desc">Employees &amp; Interns</div>
              </div>
            </div>

            <div className="sad-action-card sad-ac-task" onClick={() => setShowTaskModal(true)}>
              <div className="sad-action-icon"><ClipboardList size={20} /></div>
              <div>
                <div className="sad-action-name">Tasks</div>
                <div className="sad-action-desc">Manage assignments</div>
              </div>
            </div>

            <div className="sad-action-card sad-ac-pay" onClick={() => setShowPayslip(!showPayslip)}>
              <div className="sad-action-icon"><Banknote size={20} /></div>
              <div>
                <div className="sad-action-name">Payroll</div>
                <div className="sad-action-desc">Generate payslips</div>
              </div>
            </div>

            <div className="sad-action-card sad-ac-reports" onClick={() => setShowDownloadModal(true)}>
              <div className="sad-action-icon"><FileSpreadsheet size={20} /></div>
              <div>
                <div className="sad-action-name">Reports</div>
                <div className="sad-action-desc">Export attendance data</div>
              </div>
            </div>

          </div>

          {/* ── Recent Activity ── */}
          {logs.length > 0 && (
            <>
              <div className="sad-section-header">
                <div className="sad-section-title">Recent Activity</div>
              </div>
              <div className="sad-bottom-row">
                <div className="sad-bottom-card">
                  {logs.slice(0, 5).map((log, i) => (
                    <div className="sad-activity-item" key={i}>
                      <div className="sad-ai-dot" style={{ background: "#10b981" }} />
                      <div>
                        <div className="sad-ai-text">{log.fullname || log.name || "—"}</div>
                        <div className="sad-ai-sub">{log.role || "Employee"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Payslip inline section */}
          {showPayslip && (
            <div className="sad-payslip-section">
              <div className="sad-payslip-header">
                <h2>Payroll Generation</h2>
                <button className="sad-close-section-btn" onClick={() => setShowPayslip(false)}>
                  Close
                </button>
              </div>
              <PayslipGeneration />
            </div>
          )}

        </div>
      </div>

      {/* ── MODALS ── */}

      {showUpload && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content" style={{ maxWidth: "520px" }}>
            <button className="sad-modal-close" onClick={() => setShowUpload(false)}>✕</button>
            <AttendanceUpload />
          </div>
        </div>
      )}

      {showDirectory && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content">
            <button className="sad-modal-close" onClick={() => setShowDirectory(false)}>✕</button>
            <DirectoryPanel />
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

      {showProfileModal && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content sad-profile-modal">
            <button className="sad-modal-close" onClick={() => setShowProfileModal(false)}>✕</button>
            <SuperAdminProfile />
          </div>
        </div>
      )}

      {showAttRecords && (
  <div className="sad-modal-overlay">
    <div className="sad-modal-content">
      <button className="sad-modal-close" onClick={() => setShowAttRecords(false)}>✕</button>
      <AttendanceRecords />
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
                    setFromDate(today.toISOString().slice(0,7) + "-01");
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
              onClick={() => {
                window.open(
                  `${import.meta.env.VITE_API_URL}/attendance/export-excel?from=${fromDate}&to=${toDate}`,
                  "_blank"
                );
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
