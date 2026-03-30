import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";


export default function PayslipRequest() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ employee_id: "", month: "" });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, reqRes] = await Promise.all([
        api.get("/employees/list"),
        api.get("/payslip-requests/my"),
      ]);
      setEmployees(empRes.data);
      setRequests(reqRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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
    <div className="dpr-page">
      <div className="dpr-container" style={{ maxWidth:900 }}>

        <div className="dpr-title-bar">
          <div className="dpr-logo-area">
            <svg width="36" height="36" viewBox="0 0 40 40">
              <polygon points="20,4 36,34 4,34" fill="none" stroke="#1a3a6b" strokeWidth="3"/>
              <polygon points="20,10 30,30 10,30" fill="#1a3a6b"/>
            </svg>
            <span className="dpr-logo-text">UAV</span>
          </div>
          <h1 className="dpr-main-title">REQUEST PAYSLIP GENERATION</h1>
          <button type="button" className="dpr-back-btn" onClick={() => navigate("/admin-dashboard")}>← Back</button>
        </div>

        
        <div style={{ padding:"20px 24px", borderBottom:"1.5px solid #b0c0d8", background:"#f9fbfe" }}>
          <h3 style={{ fontSize:"0.88rem", fontWeight:700, color:"#1a3a6b", marginBottom:14 }}>
            New Payslip Request
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:12, alignItems:"end" }}>
              <div>
                <label style={{ fontSize:"0.78rem", fontWeight:600, color:"#1a3a6b",
                  display:"block", marginBottom:5 }}>Employee</label>
                <select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                  required style={{ width:"100%", border:"1px solid #b0c0d8", borderRadius:4,
                    padding:"8px 10px", fontSize:"0.82rem" }}>
                  <option value="">Select employee…</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.fullname || e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize:"0.78rem", fontWeight:600, color:"#1a3a6b",
                  display:"block", marginBottom:5 }}>Month</label>
                <input type="month" value={form.month}
                  onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
                  required style={{ width:"100%", border:"1px solid #b0c0d8", borderRadius:4,
                    padding:"8px 10px", fontSize:"0.82rem" }} />
              </div>
              <button type="submit" disabled={submitting}
                style={{ background:"#1a3a6b", color:"#fff", border:"none", borderRadius:4,
                  padding:"9px 22px", fontSize:"0.85rem", fontWeight:600,
                  cursor:"pointer", whiteSpace:"nowrap", height:38 }}>
                {submitting ? "Sending…" : "Send Request"}
              </button>
            </div>

            {msg.text && (
              <div style={{
                marginTop:12, padding:"8px 14px", borderRadius:4, fontSize:"0.82rem",
                background: msg.type === "success" ? "#d4edda" : "#f8d7da",
                color: msg.type === "success" ? "#1e7e34" : "#721c24",
                border: `1px solid ${msg.type === "success" ? "#c3e6cb" : "#f5c6cb"}`
              }}>{msg.text}</div>
            )}
          </form>
        </div>

   
        <div style={{ padding:"16px 24px 8px" }}>
          <h3 style={{ fontSize:"0.88rem", fontWeight:700, color:"#1a3a6b", marginBottom:12 }}>
            My Requests
          </h3>
        </div>

        {loading ? (
          <div style={{ padding:32, textAlign:"center", color:"#888" }}>Loading…</div>
        ) : requests.length === 0 ? (
          <div style={{ padding:32, textAlign:"center", color:"#aaa" }}>No requests yet.</div>
        ) : (
          <div className="dpr-table-wrap">
            <table className="dpr-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Employee</th>
                  <th>Month</th>
                  <th>Requested On</th>
                  <th>Status</th>
                  <th>Rejection Reason</th>
                  <th>Download</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r, i) => {
                  const sc = statusStyle(r.status);
                  return (
                    <tr key={r.id}>
                      <td style={{ padding:"8px", textAlign:"center", color:"#888" }}>{i+1}</td>
                      <td style={{ padding:"8px" }}><strong>{r.employee_name}</strong></td>
                      <td style={{ padding:"8px", textAlign:"center" }}>{r.month}</td>
                      <td style={{ padding:"8px", textAlign:"center", fontSize:"0.78rem" }}>
                        {new Date(r.created_at).toLocaleDateString("en-GB")}
                      </td>
                      <td style={{ padding:"8px", textAlign:"center" }}>
                        <span style={{ background:sc.bg, color:sc.color,
                          padding:"2px 10px", borderRadius:12, fontSize:"0.73rem", fontWeight:600 }}>
                          {sc.label}
                        </span>
                      </td>
                      <td style={{ padding:"8px", fontSize:"0.78rem", color:"#c0392b" }}>
                        {r.rejection_reason || "—"}
                      </td>
                      <td style={{ padding:"8px", textAlign:"center" }}>
                        {r.payslip_url ? (
                          <a href={r.payslip_url} target="_blank" rel="noreferrer"
                            style={{ background:"#1e7e34", color:"#fff", border:"none",
                              borderRadius:4, padding:"4px 14px", fontSize:"0.74rem",
                              cursor:"pointer", textDecoration:"none" }}>
                            ⬇ Download
                          </a>
                        ) : <span style={{ color:"#aaa", fontSize:"0.74rem" }}>Not ready</span>}
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
  );
}
