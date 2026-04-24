import { useEffect, useState } from "react";
import { api } from "../utils/api";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "../styles/Leave.css";

export default function AdminLeaveManagement() {
  const navigate = useNavigate();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  // Get current user for approved_by tracking
  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem("user")) || {}; }
    catch { return {}; }
  })();

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await api.get("/leave/all");
      setLeaves(res.data);
    } catch (err) {
      console.error("Failed to fetch leaves", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeaves(); }, []);

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/leave/status/${id}`, {
        status,
        approved_by_id: currentUser.id,
        approved_by_name: currentUser.fullname,
        approved_by_role: currentUser.role,
      });
      fetchLeaves();
    } catch (err) {
      alert(err.response?.data?.msg || "Failed to update status");
    }
  };

  const statusColor = (status) => {
    if (status === "approved") return "#10b981";
    if (status === "rejected") return "#ef4444";
    return "#f59e0b";
  };
  const statusBg = (status) => {
    if (status === "approved") return "rgba(16, 185, 129, 0.15)";
    if (status === "rejected") return "rgba(239, 68, 68, 0.15)";
    return "rgba(245, 158, 11, 0.15)";
  };

  const roleLabel = (role) => {
    if (!role) return "";
    if (role === "super_admin") return "Super Admin";
    if (role === "admin_hr") return "HR Admin";
    if (role === "admin") return "Admin";
    return role;
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

  return (
    <div className="leave-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", paddingBottom: "20px", borderBottom: "1.5px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            width: 42, height: 42,
            background: "#ffffff",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            overflow: "hidden",
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
          }}>
            <img 
              src={import.meta.env.VITE_LOGO_URL || "/logo.jpg"} 
              alt="Logo" 
              style={{ width: 36, height: 36, objectFit: "contain" }}
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
            <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1e293b", margin: 0 }}>Leave Requests</h1>
            <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>Manage employee time-off and approvals</p>
          </div>
        </div>
      </div>

      <div className="leave-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#1e293b", margin: 0 }}>LEAVE MANAGEMENT</h2>
          <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Active Approval Queue</div>
        </div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "1rem", flexWrap: "wrap" }}>
          {["all", "pending", "approved", "rejected"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "8px 20px", borderRadius: 8, border: "1px solid #334155",
                cursor: "pointer", fontWeight: 700, fontSize: "0.85rem",
                background: filter === f ? "#3b82f6" : "#1e293b",
                color: filter === f ? "#ffffff" : "#94a3b8", transition: "all 0.2s"
              }}
            >
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
                  <th>Name</th>
                  <th>UAV ID</th>
                  <th>Type</th>
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
                  <tr key={leave.id}>
                    <td>{leave.name}</td>
                    <td>{leave.employee_uav_id || "—"}</td>
                    <td><strong>{leave.leave_type}</strong></td>
                    <td>{new Date(leave.from_date).toLocaleDateString("en-IN")}</td>
                    <td>{new Date(leave.to_date).toLocaleDateString("en-IN")}</td>
                    <td>{leave.total_days}</td>
                    <td style={{ maxWidth: 160, fontSize: "0.8rem" }}>{leave.reason || "—"}</td>
                    <td style={{ fontSize: "0.78rem" }}>
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

                    {/* ── Actioned By ── */}
                    <td style={{ fontSize: "0.85rem", minWidth: 140 }}>
                      {leave.approved_by_name ? (
                        <div>
                          <div style={{ fontWeight: 700, color: "#1e293b" }}>
                            {leave.approved_by_name}
                          </div>
                          <div style={{
                            fontSize: "0.75rem", fontWeight: 600, marginTop: 2,
                            color: leave.approved_by_role === "super_admin" ? "#7c3aed" : "#2563eb"
                          }}>
                            {roleLabel(leave.approved_by_role)}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      )}
                    </td>

                    <td>
                      {leave.status === "pending" ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="approve-btn" onClick={() => updateStatus(leave.id, "approved")}
                            style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#10b981", color: "white", fontWeight: 700, cursor: "pointer" }}>
                            Approve
                          </button>
                          <button className="reject-btn" onClick={() => updateStatus(leave.id, "rejected")}
                            style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#ef4444", color: "white", fontWeight: 700, cursor: "pointer" }}>
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: "0.85rem", fontWeight: 600 }}>Processed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 30, display: "flex", justifyContent: "flex-end" }}>
        <button 
          onClick={() => {
            const role = JSON.parse(localStorage.getItem("user"))?.role;
            if (role === "super_admin") navigate("/super-admin-dashboard");
            else if (role === "admin_hr") navigate("/admin-dashboard");
            else if (role === "admin") navigate("/admin-dashboard");
            else navigate("/employee-dashboard");
          }}
          style={{
            background: "#fff",
            color: "#475569",
            border: "1px solid #e2e8f0",
            padding: "10px 24px",
            borderRadius: "10px",
            fontWeight: "700",
            fontSize: "14px",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}
