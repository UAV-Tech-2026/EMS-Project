import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";


const S = {
  page: {
    background: "#f1f5f9",
    minHeight: "100vh",
    padding: "40px",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  },
  container: {
    maxWidth: 1100,
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: 16,
    boxShadow: "0 10px 30px -5px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
    overflow: "hidden",
    border: "1px solid #e2e8f0",
  },

 
  titleBar: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "24px 32px",
    background: "#ffffff",
    borderBottom: "1px solid #f1f5f9",
  },
  logoArea: { display: "flex", alignItems: "center", gap: 10 },
  logoText: { fontSize: "1.2rem", fontWeight: 900, color: "#1e3a8a", letterSpacing: "0.05em" },
  mainTitle: { flex: 1, fontSize: "1.1rem", fontWeight: 800, color: "#1e293b", letterSpacing: "0.02em" },
  backBtn: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "8px 20px",
    fontSize: "0.85rem",
    fontWeight: 700,
    color: "#64748b",
    cursor: "pointer",
    transition: "all 0.2s",
  },


  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    background: "#f8fafc",
    borderBottom: "1px solid #f1f5f9",
  },
  statCell: (bg, border) => ({
    padding: "32px",
    background: "#ffffff",
    borderRight: border === "none" ? "none" : "1px solid #f1f5f9",
    cursor: "pointer",
    transition: "background 0.2s",
  }),
  statLabel: {
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#94a3b8",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  statValue: (color) => ({
    fontSize: "2.8rem",
    fontWeight: 900,
    color,
    lineHeight: 1,
  }),

  
  filterBar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 32px",
    borderBottom: "1px solid #f1f5f9",
    background: "#ffffff",
  },
  filterLabel: {
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginRight: 8,
  },
  filterBtn: (active) => ({
    background: active ? "#3b82f6" : "#f1f5f9",
    color: active ? "#ffffff" : "#64748b",
    border: `1px solid ${active ? "#3b82f6" : "#e2e8f0"}`,
    borderRadius: 8,
    padding: "8px 22px",
    fontSize: "0.85rem",
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.2s",
  }),

  
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  thead: { background: "#f8fafc" },
  th: {
    padding: "16px",
    color: "#64748b",
    textAlign: "left",
    fontSize: "0.75rem",
    textTransform: "uppercase",
    fontWeight: 700,
    letterSpacing: "0.05em",
    borderBottom: "2px solid #f1f5f9",
  },
  thCenter: {
    padding: "16px",
    color: "#64748b",
    textAlign: "center",
    fontSize: "0.75rem",
    textTransform: "uppercase",
    fontWeight: 700,
    letterSpacing: "0.05em",
    borderBottom: "2px solid #f1f5f9",
  },
  td: { padding: "20px 16px", color: "#334155", fontSize: "0.95rem", borderBottom: "1px solid #f1f5f9" },
  tdCenter: { padding: "20px 16px", color: "#334155", fontSize: "0.95rem", textAlign: "center", borderBottom: "1px solid #f1f5f9" },
  tdMuted: { padding: "20px 16px", color: "#94a3b8", fontSize: "0.85rem", textAlign: "center", borderBottom: "1px solid #f1f5f9" },
  tdNum: { padding: "20px 16px", color: "#cbd5e1", fontSize: "0.9rem", textAlign: "center", fontWeight: 700, borderBottom: "1px solid #f1f5f9" },
  strongName: { fontWeight: 700, color: "#1e293b" },
  rowBase: { transition: "background 0.2s" },


  badge: (bg, color) => ({
    background: bg,
    color,
    padding: "6px 14px",
    borderRadius: 50,
    fontSize: "0.75rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.02em",
    display: "inline-block",
  }),

  
  approveBtn: {
    background: "#10b981",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: "0.85rem",
    cursor: "pointer",
    fontWeight: 700,
    boxShadow: "0 4px 6px -1px rgba(16, 185, 129, 0.2)",
    transition: "all 0.2s",
  },
  rejectBtn: {
    background: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: "0.85rem",
    cursor: "pointer",
    fontWeight: 700,
    boxShadow: "0 4px 6px -1px rgba(239, 68, 68, 0.2)",
    transition: "all 0.2s",
  },
  processedTag: { fontSize: "0.75rem", color: "#94a3b8", fontWeight: 700, letterSpacing: "0.05em" },
  viewLink: { color: "#3b82f6", fontWeight: 700, textDecoration: "none" },

  emptyMsg: { padding: 64, textAlign: "center", color: "#94a3b8", fontSize: "1rem" },


  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(15, 23, 42, 0.4)",
    zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center",
    backdropFilter: "blur(8px)",
  },
  modal: {
    background: "#ffffff",
    borderRadius: 24,
    width: 500,
    padding: 40,
    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15)",
    border: "1px solid #e2e8f0",
  },
  modalTitle: { fontSize: "1.4rem", fontWeight: 800, color: "#1e293b", marginBottom: 8 },
  modalSub: { fontSize: "0.95rem", color: "#64748b", marginBottom: 32 },
  inputLabel: (color = "#64748b") => ({
    fontSize: "0.75rem", fontWeight: 700, color,
    display: "block", marginBottom: 10,
    textTransform: "uppercase", letterSpacing: "0.05em",
  }),
  input: {
    width: "100%", border: "1px solid #e2e8f0", borderRadius: 12,
    padding: "14px 18px", fontSize: "1rem", boxSizing: "border-box",
    background: "#f8fafc", color: "#1e293b", outline: "none",
    transition: "border-color 0.2s",
  },
  textarea: {
    width: "100%", border: "1px solid #e2e8f0", borderRadius: 12,
    padding: "14px 18px", fontSize: "1rem", resize: "vertical",
    fontFamily: "inherit", boxSizing: "border-box",
    background: "#f8fafc", color: "#1e293b", outline: "none",
    transition: "border-color 0.2s",
  },
  hint: { fontSize: "0.8rem", color: "#94a3b8", marginTop: 8, lineHeight: 1.5 },
  modalActions: { display: "flex", gap: 16, justifyContent: "flex-end", marginTop: 40 },
  cancelBtn: {
    background: "#f1f5f9", border: "none", borderRadius: 12,
    padding: "14px 28px", fontSize: "0.95rem", cursor: "pointer",
    color: "#64748b", fontWeight: 700, transition: "background 0.2s",
  },
  confirmBtn: (color, disabled) => ({
    background: color, color: "#fff", border: "none", borderRadius: 12,
    padding: "14px 34px", fontSize: "0.95rem", fontWeight: 800,
    cursor: "pointer", opacity: disabled ? 0.6 : 1, transition: "all 0.2s",
    boxShadow: `0 4px 14px 0 ${color}40`,
  }),
};

const statusStyle = (s) => {
  if (s === "approved") return { bg: "rgba(16,185,129,0.15)", color: "#34d399", label: "✓ Approved" };
  if (s === "rejected") return { bg: "rgba(239,68,68,0.15)",  color: "#f87171", label: "✗ Rejected" };
  return { bg: "rgba(245,158,11,0.15)", color: "#fbbf24", label: "⏳ Pending" };
};

export default function PayslipApprovals() {
  const navigate = useNavigate();
  const [requests,     setRequests]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [actionModal,  setActionModal]  = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [payslipUrl,   setPayslipUrl]   = useState("");
  const [saving,       setSaving]       = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [hoveredRow,   setHoveredRow]   = useState(null);

  useEffect(() => { fetchRequests(); }, [filterStatus]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
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
      const token = sessionStorage.getItem("token");
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/payslip-requests/${req.id}`,
        {
          status: action === "approve" ? "approved" : "rejected",
          rejection_reason: action === "reject" ? rejectReason : null,
          payslip_url: action === "approve" ? payslipUrl : null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActionModal(null); setRejectReason(""); setPayslipUrl("");
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.msg || "Action failed.");
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => { setActionModal(null); setRejectReason(""); setPayslipUrl(""); };

  const pending  = requests.filter(r => r.status === "pending").length;
  const approved = requests.filter(r => r.status === "approved").length;
  const rejected = requests.filter(r => r.status === "rejected").length;

  return (
    <div style={S.page}>
      <div style={S.container}>

        {/* ── Title bar ── */}
        <div style={S.titleBar}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36,
              background: "#ffffff",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
              border: "1px solid #e2e8f0"
            }}>
              <img 
                src={import.meta.env.VITE_LOGO_URL || "/logo.jpg"} 
                alt="Logo" 
                style={{ width: 32, height: 32, objectFit: "contain" }}
                onError={(e) => { 
                  if (e.target.src !== window.location.origin + "/logo.jpg") {
                    e.target.src = "/logo.jpg";
                  } else {
                    e.target.style.display = 'none'; 
                  }
                }}
              />
            </div>
            <div style={S.logoText}>UAV Tech</div>
          </div>
          <div style={S.mainTitle}>PAYSLIP APPROVALS</div>
        </div>

        {/* ── Stat cards ── */}
        <div style={S.statGrid}>
          {[
            { label: "Pending",  value: pending,  color: "#fbbf24", bg: "rgba(245,158,11,0.08)",  border: "1px solid #334155" },
            { label: "Approved", value: approved, color: "#34d399", bg: "rgba(16,185,129,0.08)", border: "1px solid #334155" },
            { label: "Rejected", value: rejected, color: "#f87171", bg: "rgba(239,68,68,0.08)",  border: "none" },
          ].map((s, i) => (
            <div key={i}
              style={S.statCell(s.bg, s.border)}
              onClick={() => setFilterStatus(s.label.toLowerCase())}
            >
              <div style={S.statLabel}>{s.label}</div>
              <div style={S.statValue(s.color)}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Quick filter ── */}
        <div style={S.filterBar}>
          <span style={S.filterLabel}>Quick Filter:</span>
          {["", "pending", "approved", "rejected"].map(s => (
            <button key={s}
              style={S.filterBtn(filterStatus === s)}
              onClick={() => setFilterStatus(s)}
            >
              {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        
        {loading ? (
          <div style={S.emptyMsg}>Loading requests…</div>
        ) : requests.length === 0 ? (
          <div style={S.emptyMsg}>No requests found.</div>
        ) : (
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead style={S.thead}>
                <tr>
                  <th style={S.thCenter}>#</th>
                  <th style={S.th}>Requested By</th>
                  <th style={S.th}>Employee</th>
                  <th style={S.thCenter}>Month</th>
                  <th style={S.thCenter}>Requested On</th>
                  <th style={S.thCenter}>Status</th>
                  <th style={S.thCenter}>Payslip</th>
                  <th style={S.thCenter}>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r, i) => {
                  const sc = statusStyle(r.status);
                  const isHovered = hoveredRow === r.id;
                  const isEven = i % 2 === 0;
                  return (
                    <tr key={r.id}
                      style={{
                        ...S.rowBase,
                        background: isHovered ? "#f1f5f9" : isEven ? "#ffffff" : "#fafafa",
                      }}
                      onMouseEnter={() => setHoveredRow(r.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td style={S.tdNum}>{i + 1}</td>
                      <td style={S.td}><span style={S.strongName}>{r.admin_name}</span></td>
                      <td style={S.td}>{r.employee_name}</td>
                      <td style={S.tdCenter}>
                        <span style={{ fontWeight: 600, color: "#475569" }}>{r.month}</span>
                      </td>
                      <td style={S.tdMuted}>
                        {new Date(r.created_at).toLocaleDateString("en-GB")}
                      </td>
                      <td style={S.tdCenter}>
                        <span style={S.badge(sc.bg, sc.color)}>{sc.label}</span>
                      </td>
                      <td style={S.tdCenter}>
                        {r.payslip_url
                          ? <a href={r.payslip_url} target="_blank" rel="noreferrer" style={S.viewLink}>View Docs</a>
                          : <span style={{ color: "#e2e8f0" }}>—</span>}
                      </td>
                      <td style={S.tdCenter}>
                        {r.status === "pending" ? (
                          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                            <button style={S.approveBtn}
                              onClick={() => setActionModal({ req: r, action: "approve" })}>
                              Approve
                            </button>
                            <button style={S.rejectBtn}
                              onClick={() => setActionModal({ req: r, action: "reject" })}>
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#94a3b8" }} />
                            <span style={S.processedTag}>PROCESSED</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ padding: "24px 32px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", background: "#f8fafc" }}>
          <button
            onClick={() => {
              const user = JSON.parse(sessionStorage.getItem("user") || "{}");
              if (user.role === "super_admin") navigate("/super-admin-dashboard");
              else navigate("/admin-dashboard");
            }}
            style={{
              padding: "10px 24px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              fontSize: "0.9rem",
              fontWeight: "700",
              color: "#475569",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
            }}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      
      {actionModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <h3 style={S.modalTitle}>
              {actionModal.action === "approve" ? "✅ Approve Request" : "✗ Reject Request"}
            </h3>
            <p style={S.modalSub}>
              <strong style={{ color: "#e2e8f0" }}>{actionModal.req.employee_name}</strong>
              {" "}— {actionModal.req.month}
            </p>

            {actionModal.action === "approve" && (
              <div style={{ marginBottom: 16 }}>
                <label style={S.inputLabel()}>
                  Payslip File URL or Path{" "}
                  <span style={{ color: "#475569", textTransform: "none", fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  value={payslipUrl}
                  onChange={e => setPayslipUrl(e.target.value)}
                  placeholder="https://… or leave blank"
                  style={S.input}
                />
                <p style={S.hint}>
                  If you use PayslipGeneration, the URL will be set automatically after generation.
                </p>
              </div>
            )}

            {actionModal.action === "reject" && (
              <div style={{ marginBottom: 16 }}>
                <label style={S.inputLabel("#f87171")}>Rejection Reason *</label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Reason for rejection…"
                  style={S.textarea}
                />
              </div>
            )}

            <div style={S.modalActions}>
              <button style={S.cancelBtn} onClick={closeModal}>Cancel</button>
              <button
                style={S.confirmBtn(actionModal.action === "approve" ? "#059669" : "#dc2626", saving)}
                onClick={handleAction}
                disabled={saving}
              >
                {saving ? "Processing…" : actionModal.action === "approve" ? "Confirm Approval" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
