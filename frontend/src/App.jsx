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

import MeetingCalendar from "./pages/MeetingCalendar";
import PayslipApprovals from "./pages/PayslipApprovals";

import ApplyLeave from "./pages/ApplyLeave";
import DPR from "./pages/DPR";
import AttendanceView from "./pages/AttendanceView";
import PayslipView from "./pages/PayslipView";
import Documents from "./pages/Documents";
import Settings from "./pages/Settings";
import TaskManagement from "./pages/TaskManagement";
import RequestPanel from "./pages/RequestPanel";
import DashboardSwitcher from "./components/DashboardSwitcher";
import AutoLogout from "./components/AutoLogout";

import ProtectedRoute from "./components/ProtectedRoute";

const ALL_ROLES = ["employee", "intern", "team_lead", "admin", "super_admin", "admin_hr", "hr_admin", "production_admin"];
const ADMIN_GROUP = ["admin", "super_admin", "admin_hr", "hr_admin", "production_admin"]; // ProtectedRoute now handles 'admin' as a substring
const ATTENDANCE_GROUP = ["employee", "intern", "team_lead", "admin", "admin_hr", "hr_admin", "production_admin"];

function App() {
  return (
    <AutoLogout>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Unified Dashboard Entry Point - Allow any authenticated user */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardSwitcher />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["super_admin"]} />}>
        <Route path="/super-admin-profile" element={<SuperAdminProfile />} />
        <Route path="/payslip-approvals" element={<PayslipApprovals />} />
        <Route path="/request-panel" element={<RequestPanel />} />
      </Route>


      <Route element={<ProtectedRoute allowedRoles={ADMIN_GROUP} />}>
        <Route path="/create-user" element={<CreateUser />} />
        <Route path="/payslip-generation" element={<PayslipGeneration />} />
      </Route>


      <Route element={<ProtectedRoute allowedRoles={ADMIN_GROUP} />}>
        <Route path="/bulk-attendance" element={<BulkAttendance />} />
        <Route path="/admin-dpr" element={<AdminDPR />} />
        <Route path="/task-spreadsheet" element={<TaskSpreadsheet />} />
        <Route path="/admin-leave-management" element={<AdminLeaveManagement />} />
        <Route path="/payslip-request" element={<PayslipRequest />} />
        <Route path="/meeting-calendar" element={<MeetingCalendar />} />
      </Route>


      <Route element={<ProtectedRoute allowedRoles={ALL_ROLES} />}>
        <Route path="/apply-leave" element={<ApplyLeave />} />
        <Route path="/dpr" element={<DPR />} />
        <Route path="/payslips" element={<PayslipView />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/task-management" element={<TaskManagement />} />
      </Route>


      <Route element={<ProtectedRoute allowedRoles={ATTENDANCE_GROUP} />}>
        <Route path="/attendance" element={<AttendanceView />} />
      </Route>

      {/* Backward compatibility for direct dashboard links */}
      <Route path="/employee-dashboard" element={<Navigate to="/dashboard" replace />} />
      <Route path="/admin-dashboard" element={<Navigate to="/dashboard" replace />} />
      <Route path="/super-admin-dashboard" element={<Navigate to="/dashboard" replace />} />

      <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AutoLogout>
  );
}

export default App;
