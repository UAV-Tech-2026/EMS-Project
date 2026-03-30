import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";

import AdminDashboard from "./pages/AdminDashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import EmployeeDashboard from "./pages/EmployeeDashboard";

import CreateUser from "./pages/CreateUser";
import BulkAttendance from "./pages/BulkAttendance";
import PayslipGeneration from "./pages/PayslipGeneration";
import AdminDPR from "./pages/AdminDPR";
import TaskSpreadsheet from "./pages/TaskSpreadsheet";
import AdminLeaveManagement from "./pages/AdminLeaveManagement";
import PayslipRequest from "./pages/PayslipRequest";

import SuperAdminProfile from "./pages/SuperAdminProfile";
import SuperAdminAttendance from "./pages/SuperAdminAttendance";
import TaskCalender from "./pages/TaskCalender";
import PayslipApprovals from "./pages/PayslipApprovals";

import ApplyLeave from "./pages/ApplyLeave";
import DPR from "./pages/DPR";
import AttendanceView from "./pages/AttendanceView";
import PayslipView from "./pages/PayslipView";
import Documents from "./pages/Documents";
import Settings from "./pages/Settings";
import TaskManagement from "./pages/TaskManagement";

import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>

      {/* Default Route */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* ───────── ADMIN + SUPER ADMIN ───────── */}
      <Route element={<ProtectedRoute allowedRoles={["admin", "super_admin"]} />}>
        <Route path="/create-user" element={<CreateUser />} />
        <Route path="/bulk-attendance" element={<BulkAttendance />} />
        <Route path="/payslip-generation" element={<PayslipGeneration />} />
        <Route path="/admin-dpr" element={<AdminDPR />} />
        <Route path="/task-spreadsheet" element={<TaskSpreadsheet />} />
        <Route path="/admin-leave-management" element={<AdminLeaveManagement />} />
        <Route path="/payslip-request" element={<PayslipRequest />} />
      </Route>

      {/* ───────── SUPER ADMIN ───────── */}
      <Route element={<ProtectedRoute allowedRoles={["super_admin"]} />}>
        <Route path="/super-admin-dashboard" element={<SuperAdminDashboard />} />
        <Route path="/super-admin-profile" element={<SuperAdminProfile />} />
        <Route path="/super-admin-attendance" element={<SuperAdminAttendance />} />
        <Route path="/task-reports" element={<TaskCalender />} />
        <Route path="/payslip-approvals" element={<PayslipApprovals />} />
      </Route>

      {/* ───────── ADMIN ───────── */}
      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
      </Route>

      {/* ───────── EMPLOYEE (ALL LOGGED USERS) ───────── */}
      <Route element={<ProtectedRoute allowedRoles={["employee", "admin", "super_admin"]} />}>
        <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
        <Route path="/apply-leave" element={<ApplyLeave />} />
        <Route path="/dpr" element={<DPR />} />
        <Route path="/attendance" element={<AttendanceView />} />
        <Route path="/payslips" element={<PayslipView />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/task-management" element={<TaskManagement />} />
      </Route>

      {/* 404 - Catch all */}
      <Route path="*" element={<Navigate to="/login" replace />} />

    </Routes>
  );
}

export default App;