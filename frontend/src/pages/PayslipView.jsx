import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../utils/api";
import "../styles/Leave.css"; // Reuse leave styles for simplicity or use custom

export default function PayslipView() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ month: "" });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get("/payslip-requests/my");
      setRequests(res.data);
    } catch (err) {
      console.error("Failed to fetch requests:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.month || !user) return;
    setSubmitting(true);
    setMsg({ type: "", text: "" });
    try {
      await api.post("/payslip-requests", { 
        employee_id: user.id, 
        month: form.month 
      });
      setMsg({ type: "success", text: "✅ Payslip request sent successfully." });
      setForm({ month: "" });
      fetchRequests();
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.msg || "Failed to submit request." });
    } finally {
      setSubmitting(false);
    }
  };

  const statusStyle = (s) => {
    if (s === "approved")  return { bg:"#d4edda", color:"#1e7e34", label:"✓ Approved" };
    if (s === "rejected")  return { bg:"#f8d7da", color:"#721c24", label:"✗ Rejected" };
    return { bg:"#fff3cd", color:"#856404", label:"⏳ Pending" };
  };

  return (
    <div className="leave-container" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div className="leave-card" style={{ background: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0 }}>My Payslips</h2>
          <Link to="/employee-dashboard" style={{ padding: '8px 16px', background: '#3182ce', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}>
            Back to Dashboard
          </Link>
        </div>

        <form onSubmit={handleSubmit} style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#4a5568' }}>Request New Payslip</h3>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.5rem' }}>Select Month</label>
              <input 
                type="month" 
                value={form.month} 
                onChange={e => setForm({ month: e.target.value })} 
                required 
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '6px' }}
              />
            </div>
            <button 
              type="submit" 
              disabled={submitting}
              style={{ padding: '0.5rem 1.5rem', background: '#2d3748', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
            >
              {submitting ? "Sending..." : "Request"}
            </button>
          </div>
          {msg.text && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '6px', fontSize: '0.875rem', background: msg.type === 'success' ? '#c6f6d5' : '#fed7d7', color: msg.type === 'success' ? '#22543d' : '#822727' }}>
              {msg.text}
            </div>
          )}
        </form>

        <h3 style={{ fontSize: '1.1rem', color: '#2d3748', marginBottom: '1rem' }}>Request History</h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#a0aec0' }}>Loading requests...</div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#a0aec0' }}>No payslip requests found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #edf2f7' }}>
                <th style={{ padding: '1rem', fontSize: '0.875rem', color: '#4a5568' }}>Month</th>
                <th style={{ padding: '1rem', fontSize: '0.875rem', color: '#4a5568' }}>Requested On</th>
                <th style={{ padding: '1rem', fontSize: '0.875rem', color: '#4a5568' }}>Status</th>
                <th style={{ padding: '1rem', fontSize: '0.875rem', color: '#4a5568' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r, index) => {
                const sc = statusStyle(r.status);
                return (
                  <tr key={index} style={{ borderBottom: '1px solid #edf2f7' }}>
                    <td style={{ padding: '1rem', fontSize: '0.875rem' }}>{r.month}</td>
                    <td style={{ padding: '1rem', fontSize: '0.875rem' }}>{new Date(r.created_at).toLocaleDateString("en-IN")}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ background: sc.bg, color: sc.color, padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700 }}>
                        {sc.label}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {r.payslip_url ? (
                        <a href={r.payslip_url} target="_blank" rel="noreferrer" style={{ color: '#3182ce', fontWeight: 600, textDecoration: 'none' }}>
                          Download PDF
                        </a>
                      ) : (
                        <span style={{ color: '#a0aec0', fontSize: '0.875rem' }}>Processing</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
