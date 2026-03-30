import { useState, useEffect } from "react";
import { api } from "../utils/api";
import "../styles/Leave.css";

export default function ApplyLeave() {
  const [form, setForm] = useState({
    leave_type: "",
    from_date:  "",
    to_date:    "",
    reason:     ""
  });
  const [myLeaves, setMyLeaves] = useState([]);
  const [message,  setMessage]  = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    fetchMyLeaves();
  }, []);

  const fetchMyLeaves = async () => {
    try {
      const res = await api.get("/leave/my");
      setMyLeaves(res.data);
    } catch (err) {
      console.error("Failed to fetch my leaves", err);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (new Date(form.to_date) < new Date(form.from_date)) {
      setError("To date cannot be before From date");
      return;
    }

    setLoading(true);
    try {
      await api.post("/leave/apply", form);
      setMessage("Leave request sent to admin successfully.");
      setForm({ leave_type: "", from_date: "", to_date: "", reason: "" });
      fetchMyLeaves();
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to apply leave");
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status) => {
    if (status === "approved") return "#1e7e34";
    if (status === "rejected") return "#c0392b";
    return "#856404";
  };

  const statusBg = (status) => {
    if (status === "approved") return "#d4edda";
    if (status === "rejected") return "#f8d7da";
    return "#fff3cd";
  };

  return (
    <div className="leave-container">
      <div className="leave-card">
        <h2>Apply for Leave</h2>

        {error   && <div className="leave-error">{error}</div>}
        {message && <div className="leave-success">{message}</div>}

        <form onSubmit={handleSubmit}>
          <label>Leave Type</label>
          <select
            name="leave_type"
            value={form.leave_type}
            onChange={handleChange}
            required
          >
            <option value="">Select Leave Type</option>
            <option value="CL">Casual Leave (CL)</option>
            <option value="SL">Sick Leave (SL)</option>
            <option value="CCL">Compensatory Leave (CCL)</option>
            <option value="LOP">Loss of Pay (LOP)</option>
          </select>

          <label>From Date</label>
          <input
            type="date"
            name="from_date"
            value={form.from_date}
            onChange={handleChange}
            min={new Date().toISOString().split("T")[0]}
            required
          />

          <label>To Date</label>
          <input
            type="date"
            name="to_date"
            value={form.to_date}
            onChange={handleChange}
            min={form.from_date || new Date().toISOString().split("T")[0]}
            required
          />

          <label>Reason</label>
          <textarea
            name="reason"
            placeholder="Reason for leave"
            value={form.reason}
            onChange={handleChange}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Submitting…" : "Submit Leave Request"}
          </button>
        </form>
      </div>

      {/* My Leave History */}
      {myLeaves.length > 0 && (
        <div className="leave-card" style={{ marginTop: "1.5rem" }}>
          <h3>My Leave History</h3>
          <table className="leave-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {myLeaves.map((leave) => (
                <tr key={leave.id}>
                  <td><strong>{leave.leave_type}</strong></td>
                  <td>{new Date(leave.from_date).toLocaleDateString("en-IN")}</td>
                  <td>{new Date(leave.to_date).toLocaleDateString("en-IN")}</td>
                  <td>{leave.total_days}</td>
                  <td>{leave.reason || "—"}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
