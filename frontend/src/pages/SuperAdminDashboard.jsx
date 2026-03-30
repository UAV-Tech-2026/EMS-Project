import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import {
  Users, BarChart3, LogOut, UserPlus,
  Calendar, Bell, Download, ClipboardList,
  FileSpreadsheet, Banknote, CheckSquare,
  LayoutDashboard, GitBranch
} from "lucide-react";

import DependencyTracker from "./DependencyTracker";
import TaskManagement from "./TaskManagement";
import BulkAttendance from "./BulkAttendance";
import SuperAdminProfile from "./SuperAdminProfile";
import PayslipGeneration from "./PayslipGeneration";
import "../styles/SuperAdminDashboard.css";

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEmployees: 0,
    activeEmployees: 0,
    presentToday: 0,
  });

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showBulk, setShowBulk] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showPayslip, setShowPayslip] = useState(false);
  const [showDependency, setShowDependency] = useState(false);

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

        const [statsRes, logsRes, attendanceRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/employees/stats`, { headers }),
          axios.get(`${import.meta.env.VITE_API_URL}/employees/recent`, { headers }),
          axios.get(`${import.meta.env.VITE_API_URL}/employees/attendance-today`, { headers }),
        ]);

        setStats({
          totalUsers: statsRes.data.totalUsers,
          totalEmployees: statsRes.data.totalEmployees,
          activeEmployees: statsRes.data.activeEmployees || 0,
          presentToday: attendanceRes.data.presentToday || 0,
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

  if (!user) return <div>Authenticating...</div>;
  if (loading) return <div>Loading dashboard...</div>;

  const pendingCount = stats.totalEmployees - stats.presentToday;

  return (
    <div className="sad-shell">

      {/* SIDEBAR */}
      <aside className="sad-sidebar">
        <div className="sad-nav">
          <div className="sad-nav-item sad-active">
            <LayoutDashboard size={15} /> Dashboard
          </div>

          <div className="sad-nav-item" onClick={() => navigate("/all-users")}>
            <Users size={15} /> All Users
          </div>

          <div className="sad-nav-item" onClick={() => navigate("/create-user")}>
            <UserPlus size={15} /> Create User
          </div>

          <div className="sad-nav-item" onClick={() => setShowDependency(true)}>
            <GitBranch size={15} /> Dependencies
          </div>

          <div className="sad-nav-item" onClick={() => setShowDownloadModal(true)}>
            <Download size={15} /> Export Data
          </div>
        </div>

        <button onClick={() => { localStorage.clear(); navigate("/login"); }}>
          <LogOut size={15} /> Logout
        </button>
      </aside>

      {/* MAIN */}
      <div className="sad-main">

        <h2>Welcome {user?.fullname}</h2>

        {/* STATS */}
        <div className="sad-stats-row">
          <div>Total Employees: {stats.totalEmployees}</div>
          <div>Total Users: {stats.totalUsers}</div>
          <div>Active: {stats.activeEmployees}</div>
          <div>Present Today: {stats.presentToday}</div>
          <div>Pending: {pendingCount}</div>
        </div>

        {/* ACTIONS */}
        <div className="sad-actions-grid">

          <div onClick={() => navigate("/create-user")}>
            <UserPlus /> Enroll Employee
          </div>

          <div onClick={() => setShowTaskModal(true)}>
            <ClipboardList /> Tasks
          </div>

          <div onClick={() => setShowPayslip(!showPayslip)}>
            <Banknote /> Payroll
          </div>

          <div onClick={() => setShowDependency(true)}>
            <GitBranch /> Dependencies
          </div>

          <div onClick={() => setShowDownloadModal(true)}>
            <FileSpreadsheet /> Reports
          </div>

        </div>

      </div>

      {/* MODALS */}

      {showDependency && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content">
            <button onClick={() => setShowDependency(false)}>✕</button>
            <DependencyTracker />
          </div>
        </div>
      )}

      {showTaskModal && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content">
            <button onClick={() => setShowTaskModal(false)}>✕</button>
            <TaskManagement />
          </div>
        </div>
      )}

      {showBulk && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content">
            <button onClick={() => setShowBulk(false)}>✕</button>
            <BulkAttendance />
          </div>
        </div>
      )}

      {showProfileModal && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content">
            <button onClick={() => setShowProfileModal(false)}>✕</button>
            <SuperAdminProfile />
          </div>
        </div>
      )}

      {showPayslip && <PayslipGeneration />}

    </div>
  );
}
