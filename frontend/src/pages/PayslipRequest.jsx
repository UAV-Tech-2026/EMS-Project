import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";

const S = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f0f4ff 0%, #faf5ff 50%, #f0fdfa 100%)",
    padding: "40px 24px",
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  },
  container: {
    maxWidth: 940,
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: 20,
    boxShadow: "0 20px 60px -10px rgba(79,70,229,0.12), 0 4px 6px -2px rgba(0,0,0,0.05)",
    overflow: "hidden",
    border: "1px solid rgba(226,232,240,0.8)",
  },
  header: {
    background: "linear-gradient(135deg, #1e3a8a 0%, #4f46e5 60%, #7c3aed 100%)",
    padding: "28px 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoBox: {
    width: 44,
    height: 44,
    background: "#fff",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  },
  titleGroup: {
    marginLeft: 14,
  },
  formSection: {
    padding: "28px 32px",
    background: "linear-gradient(180deg, #f8faff 0%, #fff 100%)",
    borderBottom: "1px solid #e2e8f0",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr auto",
    gap: 16,
    alignItems: "end",
  },
  label: {
    fontSize: "0.72rem",
    fontWeight: 800,
    color: "#4f46e5",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    display: "block",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    border: "1.5px solid #e2e8f0",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: "0.88rem",
    background: "#f8fafc",
    color: "#1e293b",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  submitBtn: {
    background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "11px 26px",
    fontSize: "0.88rem",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    height: 42,
    boxShadow: "0 4px 14px rgba(79,70,229,0.35)",
    transition: "all 0.2s",
  },
  tableSection: {
    padding: "24px 32px 32px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid #e2e8f0",
  },
  th: {
    padding: "12px 16px",
    background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
    fontSize: "0.7rem",
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    borderBottom: "2px solid #e2e8f0",
    textAlign: "left",
  },
  thCenter: {
    padding: "12px 16px",
    background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
    fontSize: "0.7rem",
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    borderBottom: "2px solid #e2e8f0",
    textAlign: "center",
  },
  td: {
    padding: "14px 16px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: "0.87rem",
    color: "#334155",
  },
  tdCenter: {
    padding: "14px 16px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: "0.87rem",
    color: "#334155",
    textAlign: "center",
  },
};

const statusStyle = (s) => {
  if (s === "approved") return { bg: "rgba(16,185,129,0.12)", color: "#059669", label: "✓ Approved" };
  if (s === "rejected") return { bg: "rgba(239,68,68,0.12)", color: "#dc2626", label: "✗ Rejected" };
  return { bg: "rgba(245,158,11,0.12)", color: "#d97706", label: "⏳ Pending" };
};

export default function PayslipRequest() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ employee_id: "", month: "" });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, reqRes] = await Promise.all([
        api.get("/employees/list"),
        api.get("/payslip-requests/my"),
      ]);
      setEmployees(empRes.data);
      setRequests(reqRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employee_id || !form.month) return;
    setSubmitting(true);
    setMsg({ type: "", text: "" });
    try {
      await api.post("/payslip-requests", form);
      setMsg({ type: "success", text: "✅ Payslip request sent to Super Admin." });
      setForm({ employee_id: "", month: "" });
      fetchData();
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.msg || "Failed to submit request." });
    } finally { setSubmitting(false); }
  };

  return (
    <div style={S.page}>
      <div style={S.container}>

       
        <div style={S.header}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={S.logoBox}>
              <img
                src={import.meta.env.VITE_LOGO_URL || "/logo.jpg"}
                alt="Logo"
                style={{ width: 38, height: 38, objectFit: "contain" }}
                onError={(e) => {
                  if (e.target.src !== window.location.origin + "/logo.jpg") e.target.src = "/logo.jpg";
                  else e.target.style.display = "none";
                }}
              />
            </div>
            <div style={S.titleGroup}>
              <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff", margin: 0 }}>Payslip Requests</h1>
              <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)", margin: 0 }}>Request & Track Payroll Documents</p>
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "6px 14px", fontSize: "0.78rem", fontWeight: 700, color: "#fff" }}>
            {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>

        
        <div style={S.formSection}>
          <h3 style={{ fontSize: "0.9rem", fontWeight: 800, color: "#1e293b", marginBottom: 18, marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 6, height: 20, background: "linear-gradient(180deg,#4f46e5,#7c3aed)", borderRadius: 3, display: "inline-block" }} />
            New Payslip Request
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={S.formGrid}>
              <div>
                <label style={S.label}>Employee</label>
                <select
                  value={form.employee_id}
                  onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                  required
                  style={{ ...S.input, cursor: "pointer" }}
                >
                  <option value="">Select employee…</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.fullname || e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.label}>Month</label>
                <input
                  type="month"
                  value={form.month}
                  min={`${new Date().getFullYear() - 2}-01`}
                  max={`${new Date().getFullYear() + 2}-12`}
                  onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
                  required
                  style={S.input}
                />
              </div>
              <button type="submit" disabled={submitting} style={{ ...S.submitBtn, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? "Sending…" : "Send Request"}
              </button>
            </div>

            {msg.text && (
              <div style={{
                marginTop: 14, padding: "10px 16px", borderRadius: 10, fontSize: "0.83rem", fontWeight: 600,
                background: msg.type === "success" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                color: msg.type === "success" ? "#059669" : "#dc2626",
                border: `1px solid ${msg.type === "success" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                display: "flex", alignItems: "center", gap: 8
              }}>
                {msg.text}
              </div>
            )}
          </form>
        </div>

        
        <div style={S.tableSection}>
          <h3 style={{ fontSize: "0.9rem", fontWeight: 800, color: "#1e293b", marginBottom: 18, marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 6, height: 20, background: "linear-gradient(180deg,#10b981,#059669)", borderRadius: 3, display: "inline-block" }} />
            My Requests
          </h3>

          {loading ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#94a3b8" }}>Loading…</div>
          ) : requests.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#94a3b8" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
              No payslip requests yet.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>#</th>
                    <th style={S.th}>Employee</th>
                    <th style={S.thCenter}>Month</th>
                    <th style={S.thCenter}>Requested On</th>
                    <th style={S.thCenter}>Status</th>
                    <th style={S.th}>Rejection Reason</th>
                    <th style={S.thCenter}>Download</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r, i) => {
                    const sc = statusStyle(r.status);
                    return (
                      <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa", transition: "background 0.15s" }}>
                        <td style={{ ...S.td, color: "#cbd5e1", fontWeight: 700, textAlign: "center" }}>{i + 1}</td>
                        <td style={S.td}><strong style={{ color: "#1e293b" }}>{r.employee_name}</strong></td>
                        <td style={S.tdCenter}>{r.month}</td>
                        <td style={{ ...S.tdCenter, fontSize: "0.78rem", color: "#94a3b8" }}>
                          {new Date(r.created_at).toLocaleDateString("en-GB")}
                        </td>
                        <td style={S.tdCenter}>
                          <span style={{ background: sc.bg, color: sc.color, padding: "4px 12px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 700, display: "inline-block" }}>
                            {sc.label}
                          </span>
                        </td>
                        <td style={{ ...S.td, fontSize: "0.78rem", color: "#e11d48" }}>
                          {r.rejection_reason || "—"}
                        </td>
                        <td style={S.tdCenter}>
                          {r.payslip_url ? (
                            <a href={r.payslip_url} target="_blank" rel="noreferrer"
                              style={{ background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 14px", fontSize: "0.74rem", fontWeight: 700, cursor: "pointer", textDecoration: "none", boxShadow: "0 2px 8px rgba(16,185,129,0.3)" }}>
                              ⬇ Download
                            </a>
                          ) : <span style={{ color: "#cbd5e1", fontSize: "0.74rem" }}>Not ready</span>}
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

      
      <div style={{ maxWidth: 940, margin: "24px auto 0", display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => {
            const role = JSON.parse(sessionStorage.getItem("user"))?.role;
            if (role === "super_admin") navigate("/super-admin-dashboard");
            else if (role === "admin") navigate("/admin-dashboard");
            else navigate("/employee-dashboard");
          }}
          style={{ background: "#fff", color: "#475569", border: "1px solid #e2e8f0", padding: "10px 24px", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s" }}
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}
