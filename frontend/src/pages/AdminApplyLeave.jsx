

import { useState, useEffect, useCallback } from "react";
import { api } from "../utils/api";
import {
  Plane, FileText, AlertCircle, CheckCircle, Info
} from "lucide-react";
import "../styles/Leave.css";

const today       = new Date().toISOString().split("T")[0];
const maxYearDate = new Date(
  new Date().setFullYear(new Date().getFullYear() + 2)
).toISOString().split("T")[0];

const countWorkingDays = (startStr, endStr) => {
  if (!startStr || !endStr) return 0;
  let current = new Date(startStr);
  const end   = new Date(endStr);
  let count   = 0;
  while (current <= end) {
    const day = current.getUTCDay();
    if (day !== 0) count++;
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return count;
};

const statusConfig = (status) => {
  const s = (status || "pending").toLowerCase();
  if (s === "approved") return { bg: "#dcfce7", color: "#166534", label: "Approved" };
  if (s === "rejected") return { bg: "#fee2e2", color: "#991b1b", label: "Rejected" };
  return { bg: "#fff3cd", color: "#856404", label: "Pending" };
};

export default function AdminApplyLeave() {
  const [form, setForm] = useState({
    leave_type: "", from_date: "", to_date: "",
    reason: "", certificate_path: ""
  });
  const [myLeaves, setMyLeaves] = useState([]);
  const [message,  setMessage]  = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [usage,    setUsage]    = useState({ cl: 0, ml: 0 });

  const fetchMyLeaves = useCallback(async () => {
    try {
      const res = await api.get("/leave/my");
      setMyLeaves(res.data);

      const now          = new Date();
      const currentMonth = now.getMonth();
      const currentYear  = now.getFullYear();

      const monthlyUsage = res.data
        .filter(l => {
          const d = new Date(l.from_date);
          return (
            d.getMonth()    === currentMonth &&
            d.getFullYear() === currentYear  &&
            l.status        !== "rejected"
          );
        })
        .reduce(
          (acc, l) => {
            if (l.leave_type === "CL") acc.cl += Number(l.total_days);
            if (l.leave_type === "ML") acc.ml += Number(l.total_days);
            return acc;
          },
          { cl: 0, ml: 0 }
        );

      setUsage(monthlyUsage);
    } catch (err) {
      console.error("Failed to fetch my leaves", err);
    }
  }, []);

  useEffect(() => { fetchMyLeaves(); }, [fetchMyLeaves]);

  const handleChange = (e) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (new Date(form.to_date) < new Date(form.from_date)) {
      setError("To date cannot be before From date");
      return;
    }
    if (
      form.leave_type === "ML" &&
      countWorkingDays(form.from_date, form.to_date) > 2 &&
      !form.certificate_path.trim()
    ) {
      setError("A medical certificate link is required for ML > 2 working days.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/leave/apply", form);
      setMessage("Leave request submitted. It will be reviewed by Super Admin / HR Admin.");
      setForm({ leave_type: "", from_date: "", to_date: "", reason: "", certificate_path: "" });
      fetchMyLeaves();
      setTimeout(() => setMessage(""), 6000);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to apply leave");
    } finally {
      setLoading(false);
    }
  };

  const workingDays = countWorkingDays(form.from_date, form.to_date);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Info banner for admins ── */}
      <div style={{
        background: "#eff6ff", border: "1px solid #bfdbfe",
        borderRadius: 10, padding: "12px 16px",
        display: "flex", alignItems: "center", gap: 10,
        fontSize: 13, color: "#1d4ed8"
      }}>
        <Info size={16} style={{ flexShrink: 0 }} />
        As an admin, your leave requests are routed directly to
        <strong style={{ marginLeft: 4 }}>Super Admin / HR Admin</strong> for approval.
      </div>

      <div className="leave-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

        {/* ── Apply Form ── */}
        <div className="leave-card">
          <div className="leave-card-title">
            <Plane size={18} color="#4f46e5" />
            Submit Leave Request
          </div>

          {error && (
            <div className="leave-msg leave-msg-error">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          {message && (
            <div className="leave-msg leave-msg-success">
              <CheckCircle size={16} /> {message}
            </div>
          )}

          <form className="leave-form" onSubmit={handleSubmit}>
            {/* Leave Type */}
            <div className="leave-form-group">
              <label className="leave-form-label">Leave Type</label>
              <select
                className="leave-select"
                name="leave_type"
                value={form.leave_type}
                onChange={handleChange}
                required
              >
                <option value="">Select leave category...</option>
                <option value="CL">Casual Leave (CL)</option>
                <option value="ML">Medical Leave (ML)</option>
                <option value="CCL">Compensatory Leave (CCL)</option>
                <option value="LOP">Loss of Pay (LOP)</option>
              </select>

              {form.leave_type === "CL" && (
                <div style={{ marginTop: 8, fontSize: 12, color: usage.cl >= 2 ? "#ef4444" : "#f59e0b", display: "flex", alignItems: "center", gap: 6 }}>
                  <AlertCircle size={14} />
                  {usage.cl >= 2
                    ? "You have already used your 2 CL for this month."
                    : usage.cl === 1
                      ? "You have 1 CL left for this month."
                      : "You have 2 CL available for this month."}
                </div>
              )}
              {form.leave_type === "ML" && (
                <div style={{ marginTop: 8, fontSize: 12, color: usage.ml >= 12 ? "#ef4444" : "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
                  <Info size={14} />
                  {usage.ml >= 12
                    ? "ML limit reached (12/month)."
                    : `ML used this month: ${usage.ml} / 12 days.`}
                </div>
              )}
            </div>

            {/* Medical Certificate */}
            {form.leave_type === "ML" && (
              <div className="leave-form-group">
                <label className="leave-form-label">
                  Medical Certificate Link {workingDays > 2 ? "(Required)" : "(Optional)"}
                </label>
                <input
                  className="leave-input"
                  type="url"
                  name="certificate_path"
                  value={form.certificate_path}
                  onChange={handleChange}
                  placeholder="Paste viewable Google Drive link here..."
                />
                {workingDays > 2 && (
                  <p style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>
                    * Certificate mandatory for ML longer than 2 working days.
                  </p>
                )}
              </div>
            )}

            {/* Dates */}
            <div className="leave-date-row">
              <div className="leave-form-group">
                <label className="leave-form-label">From Date</label>
                <input
                  className="leave-input"
                  type="date"
                  name="from_date"
                  value={form.from_date}
                  onChange={handleChange}
                  min={today}
                  max={maxYearDate}
                  required
                />
              </div>
              <div className="leave-form-group">
                <label className="leave-form-label">To Date</label>
                <input
                  className="leave-input"
                  type="date"
                  name="to_date"
                  value={form.to_date}
                  onChange={handleChange}
                  min={form.from_date || today}
                  max={maxYearDate}
                  required
                />
              </div>
            </div>

            {/* Working days preview */}
            {form.from_date && form.to_date && (
              <div style={{
                marginBottom: 20, padding: "10px 14px",
                background: "#f8fafc", borderRadius: 8,
                border: "1px solid #e2e8f0",
                display: "flex", justifyContent: "space-between", alignItems: "center"
              }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>Total Working Days (Mon–Sat)</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#4f46e5" }}>
                  {workingDays} {workingDays === 1 ? "Day" : "Days"}
                </span>
              </div>
            )}

            {/* Reason */}
            <div className="leave-form-group">
              <label className="leave-form-label">Reason / Remarks</label>
              <textarea
                className="leave-textarea"
                name="reason"
                placeholder="Briefly explain the reason for your leave request..."
                value={form.reason}
                onChange={handleChange}
                required
              />
            </div>

            <button className="leave-submit-btn" type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Apply for Leave"}
            </button>
          </form>
        </div>

        {/* ── Leave History ── */}
        <div className="leave-card">
          <div className="leave-card-title">
            <FileText size={18} color="#4f46e5" />
            My Leave History
          </div>

          {myLeaves.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
              <Info size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
              <p style={{ fontSize: 14 }}>No leave history found.</p>
            </div>
          ) : (
            <div className="leave-table-container">
              <table className="leave-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Duration</th>
                    <th>Days</th>
                    <th>Status</th>
                    <th>Approved By</th>
                  </tr>
                </thead>
                <tbody>
                  {myLeaves.map((leave) => {
                    const cfg = statusConfig(leave.status);
                    return (
                      <tr key={leave.id}>
                        <td><strong>{leave.leave_type}</strong></td>
                        <td>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>
                            {new Date(leave.from_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                            {" – "}
                            {new Date(leave.to_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                          </div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>
                            {new Date(leave.from_date).getFullYear()}
                          </div>
                        </td>
                        <td>{leave.total_days}</td>
                        <td>
                          <span className="leave-status-pill" style={{ background: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: "#64748b" }}>
                          {leave.approved_by_name
                            ? `${leave.approved_by_name} (${leave.approved_by_role})`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
