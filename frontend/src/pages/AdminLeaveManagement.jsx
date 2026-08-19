import { useEffect, useState } from "react";
import { api } from "../utils/api";
import { useNavigate } from "react-router-dom";
import "../styles/Leave.css";

export default function AdminLeaveManagement({ readOnly }) {
  const navigate = useNavigate();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState(null);

  const currentUser = (() => {
    try { return JSON.parse(sessionStorage.getItem("user")) || {}; }
    catch { return {}; }
  })();

  const isSuperAdmin = 
    currentUser.role && 
    typeof currentUser.role === "string" && 
    currentUser.role.toLowerCase().replace(/[^a-z]/g, '') === "superadmin";

  const fetchLeaves = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/leave/all");
      setLeaves(res.data);
    } catch (err) {
      console.error("Failed to fetch leaves", err);
      setError(err.response?.data?.msg || "Failed to load leave data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeaves(); }, []);

  const updateStatus = async (id, status) => {
    if (readOnly) return;
    try {
      await api.put(`/leave/status/${id}`, { status });
      fetchLeaves();
    } catch (err) {
      alert(err.response?.data?.msg || "Failed to update status");
    }
  };

  const statusColor = (s) =>
    s === "approved" ? "#10b981" : s === "rejected" ? "#ef4444" : "#f59e0b";
  const statusBg = (s) =>
    s === "approved" ? "rgba(16,185,129,0.12)" : s === "rejected" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)";

  const roleLabel = (role) => {
    if (!role) return "";
    const map = { super_admin: "Super Admin", admin: "Admin" };
    return map[role] || role;
  };

  
  const ScenarioBadge = ({ leave }) => {
    const isAdminLeave = leave.target_approver_role === "super_admin" || leave.applicant_role === "admin" || leave.applicant_role === "super_admin";
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "2px 8px", borderRadius: 10, fontSize: "0.7rem", fontWeight: 700,
        background: isAdminLeave ? "rgba(124,58,237,0.12)" : "rgba(37,99,235,0.10)",
        color: isAdminLeave ? "#7c3aed" : "#2563eb",
        border: `1px solid ${isAdminLeave ? "rgba(124,58,237,0.25)" : "rgba(37,99,235,0.2)"}`,
        whiteSpace: "nowrap"
      }}>
        {isAdminLeave ? " Admin Leave" : " Employee Leave"}
      </span>
    );
  };

  const canAction = (leave) => {
    if (readOnly) return false;
    if (leave.status !== "pending") return false;

    const isApplicantAdmin = leave.target_approver_role === "super_admin" || leave.applicant_role === "admin" || leave.applicant_role === "super_admin";

    if (isApplicantAdmin) {
      return isSuperAdmin;
    } else {
      return isSuperAdmin || (currentUser.role === "admin" && leave.applicant_department === currentUser.department);
    }
  };

  // For dept admins — show a locked reason
  const lockReason = (leave) => {
    const isApplicantAdmin = leave.target_approver_role === "super_admin" || leave.applicant_role === "admin" || leave.applicant_role === "super_admin";

    if (isApplicantAdmin) {
      if (!isSuperAdmin) {
        return "Only Super Admin can approve";
      }
    } else {
      if (!isSuperAdmin && leave.applicant_department !== currentUser.department) {
        return `Only ${leave.applicant_department || "Department"} Admin or Super Admin can approve`;
      }
    }
    return null;
  };

  const filtered = filter === "all"
    ? leaves
    : leaves.filter(l => l.status === filter);

  const counts = {
    all: leaves.length,
    pending: leaves.filter(l => l.status === "pending").length,
    approved: leaves.filter(l => l.status === "approved").length,
    rejected: leaves.filter(l => l.status === "rejected").length,
  };

  // ── Stats for super admin ──
  const adminLeaves = leaves.filter(l => l.target_approver_role === "super_admin" || l.applicant_role === "admin" || l.applicant_role === "super_admin");
  const employeeLeaves = leaves.filter(l => !(l.target_approver_role === "super_admin" || l.applicant_role === "admin" || l.applicant_role === "super_admin"));

  return (
    <div className="leave-container">
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, paddingBottom: 20, borderBottom: "1.5px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 42, height: 42, background: "#fff", borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
          }}>
            <img
              src={import.meta.env.VITE_LOGO_URL || "/logo.jpg"} alt="Logo"
              style={{ width: 36, height: 36, objectFit: "contain" }}
              onError={(e) => { e.target.src = "/logo.jpg"; }}
            />
          </div>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1e293b", margin: 0 }}>Leave Requests</h1>
            <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
              {isSuperAdmin ? "All departments · Admin & Employee leaves" : "Your department's employee leaves"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Scenario Summary Cards for Super Admin ── */}
      {isSuperAdmin && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div style={{
            background: "linear-gradient(135deg, rgba(37,99,235,0.06), rgba(37,99,235,0.02))",
            border: "1px solid rgba(37,99,235,0.18)", borderRadius: 12, padding: "14px 18px"
          }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: 1 }}>
              👤 Scenario 1 — Employee Leaves
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#1e293b", marginTop: 4 }}>{employeeLeaves.length}</div>
            <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 2 }}>
              {employeeLeaves.filter(l => l.status === "pending").length} pending · Dept Admin or Super Admin can approve
            </div>
          </div>
          <div style={{
            background: "linear-gradient(135deg, rgba(124,58,237,0.07), rgba(124,58,237,0.02))",
            border: "1px solid rgba(124,58,237,0.2)", borderRadius: 12, padding: "14px 18px"
          }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 1 }}>
               Scenario 2 — Admin Leaves
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#1e293b", marginTop: 4 }}>{adminLeaves.length}</div>
            <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 2 }}>
              {adminLeaves.filter(l => l.status === "pending").length} pending · Super Admin can approve
            </div>
          </div>
        </div>
      )}

      {/* ── Dept Admin info banner ── */}
      {!isSuperAdmin && (
        <div style={{
          background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.15)",
          borderRadius: 10, padding: "10px 16px", marginBottom: 16,
          fontSize: "0.78rem", color: "#1e40af", fontWeight: 600
        }}>
         
        </div>
      )}

      {/* ── Error Banner ── */}
      {error && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fca5a5",
          borderRadius: 10, padding: "12px 16px", marginBottom: 16,
          color: "#dc2626", fontWeight: 600, fontSize: "0.85rem",
          display: "flex", alignItems: "center", gap: 8
        }}>
          ⚠️ {error}
        </div>
      )}

      <div className="leave-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#1e293b", margin: 0 }}>LEAVE MANAGEMENT</h2>
          <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Approval Queue</div>
        </div>

        {/* ── Filter buttons ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" }}>
          {["all", "pending", "approved", "rejected"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "8px 20px", borderRadius: 8, border: "1px solid #334155",
              cursor: "pointer", fontWeight: 700, fontSize: "0.85rem",
              background: filter === f ? "#3b82f6" : "#1e293b",
              color: filter === f ? "#fff" : "#94a3b8", transition: "all 0.2s"
            }}>
              {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#888" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#aaa" }}>No leave requests found.</div>
        ) : (
          <div className="leave-table-container">
            <table className="leave-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name</th>
                  <th>UTPL ID</th>
                  <th>Leave</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Applied On</th>
                  <th>Status</th>
                  <th>Actioned By</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((leave) => (
                  <tr key={leave.id} style={{
                    background: leave.target_approver_role === "super_admin"
                      ? "rgba(124,58,237,0.03)"
                      : undefined
                  }}>
                    <td><ScenarioBadge leave={leave} /></td>
                    <td style={{ fontWeight: 600 }}>{leave.name}</td>
                    <td style={{ fontSize: "0.8rem", color: "#64748b" }}>{leave.employee_uav_id || "—"}</td>
                    <td><strong>{leave.leave_type}</strong></td>
                    <td>{new Date(leave.from_date).toLocaleDateString("en-IN")}</td>
                    <td>{new Date(leave.to_date).toLocaleDateString("en-IN")}</td>
                    <td style={{ textAlign: "center" }}>{leave.total_days}</td>
                    <td style={{ maxWidth: 140, fontSize: "0.78rem" }}>{leave.reason || "—"}</td>
                    <td style={{ fontSize: "0.75rem" }}>
                      {new Date(leave.applied_at).toLocaleDateString("en-IN")}
                    </td>
                    <td>
                      <span style={{
                        background: statusBg(leave.status), color: statusColor(leave.status),
                        padding: "2px 10px", borderRadius: 12, fontSize: "0.78rem", fontWeight: 600
                      }}>
                        {leave.status}
                      </span>
                    </td>

                    {/* ── Actioned By — audit trail for Super Admin ── */}
                    <td style={{ fontSize: "0.82rem", minWidth: 150 }}>
                      {leave.approved_by_name ? (
                        <div>
                          <div style={{ fontWeight: 700, color: "#1e293b" }}>
                            {leave.approved_by_name}
                          </div>
                          <div style={{
                            fontSize: "0.72rem", fontWeight: 700, marginTop: 2,
                            color: leave.approved_by_role === "super_admin" ? "#7c3aed" : "#2563eb"
                          }}>
                            {roleLabel(leave.approved_by_role)}
                          </div>
                          {/* Show approver's UAV ID if available — helps Super Admin track which admin acted */}
                          {isSuperAdmin && leave.approved_by_uav_id && (
                            <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: 1 }}>
                              {leave.approved_by_uav_id}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: "0.78rem" }}>
                          {leave.status === "pending" ? "Awaiting" : "—"}
                        </span>
                      )}
                    </td>

                    {/* ── Action buttons ── */}
                    <td>
                      {leave.status === "pending" ? (
                        canAction(leave) ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => updateStatus(leave.id, "approved")}
                              style={{
                                padding: "5px 12px", borderRadius: 6, border: "none",
                                background: "#10b981", color: "white", fontWeight: 700,
                                cursor: "pointer", fontSize: "0.78rem"
                              }}>
                              Approve
                            </button>
                            <button
                              onClick={() => updateStatus(leave.id, "rejected")}
                              style={{
                                padding: "5px 12px", borderRadius: 6, border: "none",
                                background: "#ef4444", color: "white", fontWeight: 700,
                                cursor: "pointer", fontSize: "0.78rem"
                              }}>
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{
                            color: "#7c3aed", fontSize: "0.72rem", fontWeight: 700,
                            background: "rgba(124,58,237,0.08)", padding: "3px 8px",
                            borderRadius: 6, display: "inline-block"
                          }}>
                            🔐 {lockReason(leave)}
                          </span>
                        )
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: "0.82rem", fontWeight: 600 }}>
                          Processed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Back button ── */}
      <div style={{ marginTop: 30, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => {
            const role = JSON.parse(sessionStorage.getItem("user"))?.role;
            if (role === "super_admin" || role === "superadmin" || role === "SUPER_ADMIN") navigate("/super-admin-dashboard");
            else navigate("/admin-dashboard");
          }}
          style={{
            background: "#fff", color: "#475569", border: "1px solid #e2e8f0",
            padding: "10px 24px", borderRadius: 10, fontWeight: 700, fontSize: 14,
            cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
            display: "flex", alignItems: "center", gap: 8
          }}>
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}
