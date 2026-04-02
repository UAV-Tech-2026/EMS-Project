import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminDPR from "./AdminDPR";
import "../styles/AdminDashboard.css";
import { api } from "../utils/api";
import AttendanceRecords from "./AttendanceRecords";
import DirectoryPanel from "./DirectoryPanel";
import AdminLeaveManagement from "./AdminLeaveManagement";
import {
  Menu, X, ClipboardCheck, CalendarCheck, Users,
  ClipboardList, Banknote, ListTodo, LogOut, UserCheck
} from "lucide-react";

import BulkAttendance from "./BulkAttendance";
import CreateUser from "./CreateUser";
import TaskManagement from "./TaskManagement";
import AttendanceUpload from "./AttendanceUpload";


export default function AdminDashboard() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [showDirectory, setShowDirectory] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showDPR, setShowDPR] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showAttRecords, setShowAttRecords] = useState(false);

  const [taskStats, setTaskStats] = useState({
    total_tasks: 0,
    assigned_tasks: 0,
    dependent_tasks: 0,
  });

  useEffect(() => {
    const fetchTaskStats = async () => {
      try {
        const res = await api.get("/tasks/stats");
        setTaskStats(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchTaskStats();
  }, []);

  return (
    <div className="dashboard-container">
      <div className="mobile-header">
        <button onClick={() => setSidebarOpen(true)}><Menu /></button>
        <h2>Admin</h2>
      </div>

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <h2>UAV Tech</h2>
          <X className="close-btn" onClick={() => setSidebarOpen(false)} />
        </div>

        <nav>
          <button onClick={() => { setShowBulk(true); setSidebarOpen(false); }}><ClipboardCheck /> Attendance</button>
          <button onClick={() => { setShowUpload(true); setSidebarOpen(false); }}><ClipboardCheck /> Upload Attendance</button>
          <button onClick={() => navigate("/admin-leave-management")}><CalendarCheck /> Leave</button>
          <button onClick={() => { setShowEnroll(true); setSidebarOpen(false); }}><Users /> Employees</button>
          <button onClick={() => { setShowDPR(true); setSidebarOpen(false); }}><ClipboardList /> DPR</button>
          <button onClick={() => navigate("/payslip-request")}><Banknote /> Payslip</button>
          <button onClick={() => { setShowTaskModal(true); setSidebarOpen(false); }}><ListTodo /> Tasks</button>
          <button onClick={() => { setShowDirectory(true); setSidebarOpen(false); }}><Users /> Directory</button>
        </nav>

        <button className="logout" onClick={() => { localStorage.clear(); navigate("/login"); }}>
          <LogOut /> Logout
        </button>
      </aside>

      <main className="main">
        <div className="header">
          <h1>Admin Dashboard</h1>
          <p>Manage your organization efficiently</p>
        </div>

        <div className="stats">
          <div className="card" onClick={() => setShowTaskModal(true)}>
            <ListTodo />
            <h3>Total Tasks</h3>
            <p>{taskStats.total_tasks}</p>
          </div>
          <div className="card">
            <UserCheck />
            <h3>Assigned</h3>
            <p>{taskStats.assigned_tasks}</p>
          </div>
          <div className="card">
            <UserCheck />
            <h3>Dependent</h3>
            <p>{taskStats.dependent_tasks}</p>
          </div>
        </div>

        <div className="grid">
          <div className="action-card" onClick={() => setShowBulk(true)}>
            <ClipboardCheck />
            <h4>Attendance</h4>
          </div>
          <div className="action-card" onClick={() => setShowUpload(true)}>
            <ClipboardList />
            <h4>Upload Attendance</h4>
          </div>
          <div className="action-card" onClick={() => setShowDirectory(true)}>
            <Users />
            <h4>Directory</h4>
          </div>
          <div className="action-card" onClick={() => setShowDPR(true)}>
            <ClipboardList />
            <h4>DPR</h4>
          </div>
          <div className="action-card" onClick={() => navigate("/payslip-request")}>
            <Banknote />
            <h4>Payslip</h4>
          </div>
          <div className="action-card" onClick={() => navigate("/admin-leave-management")}>
            <CalendarCheck />
            <h4>Leave</h4>
          </div>
          <div className="action-card" onClick={() => setShowAttRecords(true)}>
  <ClipboardCheck />
  <h4>View Attendance</h4>
</div>
          <div className="action-card" onClick={() => setShowEnroll(true)}>
            <Users />
            <h4>Enroll Employees</h4>
          </div>
          <div className="action-card" onClick={() => setShowTaskModal(true)}>
            <ListTodo />
            <h4>Tasks</h4>
          </div>
        </div>
      </main>

      {showUpload && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content">
            <button className="sad-modal-close" onClick={() => setShowUpload(false)}>✕</button>
            <AttendanceUpload />
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

      {showDPR && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content">
            <button className="sad-modal-close" onClick={() => setShowDPR(false)}>✕</button>
            <AdminDPR />
          </div>
        </div>
      )}

      {showEnroll && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content">
            <button className="sad-modal-close" onClick={() => setShowEnroll(false)}>✕</button>
            <CreateUser onSuccess={() => setShowEnroll(false)} />
          </div>
        </div>
      )}

      {showLeave && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content">
            <button className="sad-modal-close" onClick={() => setShowLeave(false)}>✕</button>
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

      {showDirectory && (
        <div className="sad-modal-overlay">
          <div className="sad-modal-content">
            <button className="sad-modal-close" onClick={() => setShowDirectory(false)}>✕</button>
            <DirectoryPanel />
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
    </div>
  );
}
