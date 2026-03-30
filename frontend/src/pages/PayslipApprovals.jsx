import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";


export default function PayslipApprovals() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(null); 
  const [rejectReason, setRejectReason] = useState("");
  const [payslipUrl, setPayslipUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => { fetchRequests(); }, [filterStatus]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const params = filterStatus ? `?status=${filterStatus}` : "";
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/payslip-requests/all${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRequests(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!actionModal) return;
    const { req, action } = actionModal;
    if (action === "reject" && !rejectReason.trim()) {
      alert("Please provide a rejection reason."); return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/payslip-requests/${req.id}`,
        {
          status: action === "approve" ? "approved" : "rejected",
          rejection_reason: action === "reject" ? rejectReason : null,
          payslip_url: action === "approve" ? payslipUrl : null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActionModal(null);
      setRejectReason("");
      setPayslipUrl("");
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.msg || "Action failed.");
    } finally {
      setSaving(false);
    }
  };

  const statusStyle = (s) => {
    if (s === "approved")  return { bg:"rgba(16, 185, 129, 0.15)", color:"#10b981", label:"✓ Approved" };
    if (s === "rejected")  return { bg:"rgba(239, 68, 68, 0.15)", color:"#ef4444", label:"✗ Rejected" };
    return { bg:"rgba(245, 158, 11, 0.15)", color:"#f59e0b", label:"⏳ Pending" };
  };

  const pending  = requests.filter(r => r.status === "pending").length;
  const approved = requests.filter(r => r.status === "approved").length;
  const rejected = requests.filter(r => r.status === "rejected").length;

  return (
    <div className="dpr-page" style={{ background: "#0f172a", minHeight: "100vh", padding: "40px" }}>
      <div className="dpr-container" style={{ maxWidth:1100, background: "#1e293b", borderRadius: "16px", border: "1px solid #334155", overflow: "hidden" }}>

        <div className="dpr-title-bar">
          <div className="dpr-logo-area">
            <svg width="36" height="36" viewBox="0 0 40 40">
              <polygon points="20,4 36,34 4,34" fill="none" stroke="#1a3a6b" strokeWidth="3"/>
              <polygon points="20,10 30,30 10,30" fill="#1a3a6b"/>
            </svg>
            <span className="dpr-logo-text">UAV</span>
          </div>
          <h1 className="dpr-main-title">PAYSLIP REQUEST APPROVALS</h1>
          <button type="button" className="dpr-back-btn" onClick={() => navigate("/super-admin-dashboard")}>← Back</button>
        </div>

        
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)",
          borderBottom:"1px solid #334155" }}>
          {[
            { label:"Pending",  value:pending,  color:"#f59e0b", bg:"rgba(245, 158, 11, 0.05)" },
            { label:"Approved", value:approved, color:"#10b981", bg:"rgba(16, 185, 129, 0.05)" },
            { label:"Rejected", value:rejected, color:"#ef4444", bg:"rgba(239, 68, 68, 0.05)" },
          ].map((s,i) => (
            <div key={i} style={{ padding:"24px", background:s.bg,
              borderRight: i<2 ? "1px solid #334155" : "none", cursor:"pointer" }}
              onClick={() => setFilterStatus(s.label.toLowerCase())}>
              <div style={{ fontSize:"0.75rem", fontWeight:700, color:"#94a3b8", marginBottom:6, textTransform: "uppercase", letterSpacing: "1px" }}>{s.label}</div>
              <div style={{ fontSize:"2.2rem", fontWeight:800, color:s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 24px",
          borderBottom:"1px solid #334155", background:"#1e293b" }}>
          <label style={{ fontSize:"0.8rem", fontWeight:700, color:"#94a3b8", textTransform: "uppercase" }}>Quick Filter:</label>
          {["", "pending", "approved", "rejected"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ background: filterStatus === s ? "#3b82f6" : "#0f172a",
                color: "#ffffff",
                border:"1px solid #334155", borderRadius:6,
                padding:"6px 16px", fontSize:"0.8rem", cursor:"pointer", fontWeight: 700 }}>
              {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading requests…</div>
        ) : requests.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#475569" }}>No requests found.</div>
        ) : (
          <div className="dpr-table-wrap" style={{ background: "#1e293b" }}>
            <table className="dpr-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255, 255, 255, 0.05)" }}>
                  <th style={{ padding: "16px", color: "#ffffff", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 800 }}>#</th>
                  <th style={{ padding: "16px", color: "#ffffff", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 800 }}>Requested By</th>
                  <th style={{ padding: "16px", color: "#ffffff", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 800 }}>Employee</th>
                  <th style={{ padding: "16px", color: "#ffffff", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 800 }}>Month</th>
                  <th style={{ padding: "16px", color: "#ffffff", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 800 }}>Requested On</th>
                  <th style={{ padding: "16px", color: "#ffffff", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 800 }}>Status</th>
                  <th style={{ padding: "16px", color: "#ffffff", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 800 }}>Payslip</th>
                  <th style={{ padding: "16px", color: "#ffffff", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 800 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r, i) => {
                  const sc = statusStyle(r.status);
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid #334155" }}>
                      <td style={{ padding: "16px", textAlign: "center", color: "#94a3b8" }}>{i + 1}</td>
                      <td style={{ padding: "16px", color: "#f1f5f9" }}><strong>{r.admin_name}</strong></td>
                      <td style={{ padding: "16px", color: "#f1f5f9" }}>{r.employee_name}</td>
                      <td style={{ padding: "16px", textAlign: "center", color: "#f1f5f9" }}>{r.month}</td>
                      <td style={{ padding: "16px", textAlign: "center", fontSize: "0.80rem", color: "#94a3b8" }}>
                        {new Date(r.created_at).toLocaleDateString("en-GB")}
                      </td>
                      <td style={{ padding: "16px", textAlign: "center" }}>
                        <span style={{
                          background: sc.bg, color: sc.color,
                          padding: "4px 12px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase"
                        }}>
                          {sc.label}
                        </span>
                      </td>
                      <td style={{ padding: "16px", textAlign: "center" }}>
                        {r.payslip_url
                          ? <a href={r.payslip_url} target="_blank" rel="noreferrer"
                            style={{ color: "#3b82f6", fontWeight: 700 }}>View</a>
                          : <span style={{ color: "#475569" }}>—</span>}
                      </td>
                      <td style={{ padding: "16px", textAlign: "center" }}>
                        {r.status === "pending" ? (
                          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                            <button onClick={() => setActionModal({ req: r, action: "approve" })}
                              style={{
                                background: "#10b981", color: "#fff", border: "none",
                                borderRadius: 6, padding: "6px 14px", fontSize: "0.8rem", cursor: "pointer", fontWeight: 700
                              }}>
                              Approve
                            </button>
                            <button onClick={() => setActionModal({ req: r, action: "reject" })}
                              style={{
                                background: "#ef4444", color: "#fff", border: "none",
                                borderRadius: 6, padding: "6px 14px", fontSize: "0.8rem", cursor: "pointer", fontWeight: 700
                              }}>
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.8rem", color: "#475569", fontWeight: 700 }}>PROCESSED</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      
      {actionModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 999,
          display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)"
        }}>
          <div style={{
            background: "#1e293b", borderRadius: 12, width: 480, padding: 32,
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)", border: "1px solid #334155"
          }}>

            <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#ffffff", marginBottom: 8 }}>
              {actionModal.action === "approve" ? "✅ Approve Request" : "✗ Reject Request"}
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#94a3b8", marginBottom: 24 }}>
              <strong>{actionModal.req.employee_name}</strong> — {actionModal.req.month}
            </p>

            {actionModal.action === "approve" && (
              <div style={{ marginBottom: 20 }}>
                <label style={{
                  fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8",
                  display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "1px"
                }}>
                  Payslip File URL or Path <span style={{ color: "#475569", fontWeight: 400 }}>(optional)</span>
                </label>
                <input value={payslipUrl} onChange={e => setPayslipUrl(e.target.value)}
                  placeholder="https://... or leave blank"
                  style={{
                    width: "100%", border: "1px solid #334155", borderRadius: 8,
                    padding: "12px 14px", fontSize: "0.875rem", boxSizing: "border-box",
                    background: "#0f172a", color: "#ffffff", outline: "none"
                  }} />
                <p style={{ fontSize: "0.75rem", color: "#475569", marginTop: 8 }}>
                  If you use PayslipGeneration, the URL will be set automatically after generation.
                </p>
              </div>
            )}

            {actionModal.action === "reject" && (
              <div style={{ marginBottom: 20 }}>
                <label style={{
                  fontSize: "0.75rem", fontWeight: 700, color: "#ef4444",
                  display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "1px"
                }}>
                  Rejection Reason *
                </label>
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                  rows={3} placeholder="Reason for rejection…"
                  style={{
                    width: "100%", border: "1px solid #334155", borderRadius: 8,
                    padding: "12px 14px", fontSize: "0.875rem", resize: "vertical",
                    fontFamily: "inherit", boxSizing: "border-box", background: "#0f172a",
                    color: "#ffffff", outline: "none"
                  }} />
              </div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 32 }}>
              <button onClick={() => { setActionModal(null); setRejectReason(""); setPayslipUrl(""); }}
                style={{
                  background: "transparent", border: "1px solid #334155", borderRadius: 8,
                  padding: "10px 24px", fontSize: "0.875rem", cursor: "pointer", color: "#94a3b8",
                  fontWeight: 700, transition: "all 0.2s"
                }}>
                Cancel
              </button>
              <button onClick={handleAction} disabled={saving}
                style={{
                  background: actionModal.action === "approve" ? "#10b981" : "#ef4444",
                  color: "#ffffff", border: "none", borderRadius: 8,
                  padding: "10px 32px", fontSize: "0.875rem", fontWeight: 800,
                  cursor: "pointer", opacity: saving ? 0.7 : 1, transition: "all 0.2s"
                }}>
                {saving ? "Processing…" : actionModal.action === "approve" ? "Confirm Approval" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
