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
  const [ytdData, setYtdData] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      const u = JSON.parse(stored);
      setUser(u);
      fetchYtd(u.id);
    }
    fetchRequests();
  }, []);

  const fetchYtd = async (uid) => {
    try {
      const today = new Date();
      const from = `${today.getFullYear()}-01-01`;
      const to = today.toISOString().split('T')[0];
      const res = await api.get(`/payslip/my?from=${from}&to=${to}`);
      setYtdData(res.data);
    } catch (err) {
      console.error("YTD Fetch failed", err);
    }
  };

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
                style={{ height: '36px', width: '36px', objectFit: 'contain' }} 
                onError={(e) => { 
                  if (e.target.src !== window.location.origin + "/logo.jpg") {
                    e.target.src = "/logo.jpg";
                  } else {
                    e.target.style.display = 'none'; 
                  }
                }} 
              />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>My Payslips</h2>
          </div>
        </div>

        {/* YTD Dashboard for Employee */}
        {ytdData && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ background: 'linear-gradient(135deg, #ebf8ff 0%, #bee3f8 100%)', padding: '1.5rem', borderRadius: '12px', border: '1px solid #90cdf4' }}>
              <div style={{ color: '#2c5282', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>YTD Gross (Jan - Dec)</div>
              <div style={{ color: '#2a4365', fontSize: '1.5rem', fontWeight: 800 }}>₹{ytdData.cumulative.ytd_gross.toLocaleString("en-IN")}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%)', padding: '1.5rem', borderRadius: '12px', border: '1px solid #feb2b2' }}>
              <div style={{ color: '#822727', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>YTD Deductions</div>
              <div style={{ color: '#742a2a', fontSize: '1.5rem', fontWeight: 800 }}>₹{ytdData.cumulative.ytd_deductions.toLocaleString("en-IN")}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%)', padding: '1.5rem', borderRadius: '12px', border: '1px solid #9ae6b4' }}>
              <div style={{ color: '#22543d', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>YTD Net Paid</div>
              <div style={{ color: '#234e33', fontSize: '1.5rem', fontWeight: 800 }}>₹{ytdData.cumulative.ytd_net.toLocaleString("en-IN")}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#4a5568' }}>Request New Payslip</h3>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.5rem' }}>Select Month</label>
              <input 
                type="month" 
                value={form.month} 
                min={`${new Date().getFullYear() - 2}-01`}
                max={`${new Date().getFullYear() + 2}-12`}
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

      <div style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end" }}>
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
