import { useEffect, useState } from "react";
import { api } from "../utils/api";
import "../styles/Leave.css";

export default function AdminLeaveManagement() {
  const [leaves,  setLeaves]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("all");

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
      await api.put(`/leave/status/${id}`, { status });
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

  const filtered = filter === "all"
    ? leaves
    : leaves.filter(l => l.status === filter);

  const counts = {
    all:      leaves.length,
    pending:  leaves.filter(l => l.status === "pending").length,
    approved: leaves.filter(l => l.status === "approved").length,
    rejected: leaves.filter(l => l.status === "rejected").length,
  };

  return (
    <div className="leave-container">
      <div className="leave-card">
        <h2>Leave Management</h2>

        {/* Filter Tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "1rem", flexWrap: "wrap" }}>
          {["all", "pending", "approved", "rejected"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding:      "8px 20px",
                borderRadius: 8,
                border:       "1px solid #334155",
                cursor:       "pointer",
                fontWeight:   700,
                fontSize:     "0.85rem",
                background:   filter === f ? "#3b82f6" : "#1e293b",
                color:        filter === f ? "#ffffff" : "#94a3b8",
                transition:   "all 0.2s"
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
                      background:   statusBg(leave.status),
                      color:        statusColor(leave.status),
                      padding:      "2px 10px",
                      borderRadius: 12,
                      fontSize:     "0.78rem",
                      fontWeight:   600
                    }}>
                      {leave.status}
                    </span>
                  </td>
                  <td>
                    {leave.status === "pending" ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="approve-btn"
                          onClick={() => updateStatus(leave.id, "approved")}
                        >
                          ✓ Approve
                        </button>
                        <button
                          className="reject-btn"
                          onClick={() => updateStatus(leave.id, "rejected")}
                        >
                          ✗ Reject
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: "#aaa", fontSize: "0.78rem" }}>Done</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
