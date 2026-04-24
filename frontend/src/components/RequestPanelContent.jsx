import React, { useState, useEffect, useRef } from "react";
import { api } from "../utils/api";
import axios from "axios";
import {
  Send, Calendar, Clock,
  FileText, User, CheckCircle,
  XCircle, Clock8, ThumbsUp, ThumbsDown,
  Upload, FilePlus, X, File, Download, Link2, ExternalLink,
  Inbox, CreditCard, MessageSquare, RefreshCw
} from "lucide-react";

const S = {
  wrapper: {
    padding: "0",
    fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
  },
  tabBar: {
    display: "flex",
    gap: 8,
    marginBottom: 24,
    background: "#f1f5f9",
    borderRadius: 12,
    padding: 4,
  },
  tab: (active) => ({
    flex: 1,
    padding: "10px 16px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "0.82rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transition: "all 0.2s",
    background: active ? "#fff" : "transparent",
    color: active ? "#4f46e5" : "#64748b",
    boxShadow: active ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
  }),
  badge: (color) => ({
    padding: "2px 7px",
    borderRadius: 20,
    fontSize: "0.68rem",
    fontWeight: 800,
    background: color === "amber" ? "#fef3c7" : color === "purple" ? "#ede9fe" : "#dbeafe",
    color: color === "amber" ? "#92400e" : color === "purple" ? "#5b21b6" : "#1d4ed8",
    marginLeft: 4,
  }),
  sectionHeader: {
    background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
    color: "#fff",
    padding: "14px 22px",
    borderRadius: "12px 12px 0 0",
    fontWeight: 800,
    fontSize: "14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.04)",
    marginBottom: 24,
  },
  emptyState: {
    padding: "48px 32px",
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 13,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
  },
  reqRow: (hover) => ({
    padding: "14px 22px",
    borderBottom: "1px solid #f1f5f9",
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    transition: "background 0.15s",
    background: hover ? "#f8fafc" : "#fff",
  }),
  statusBadge: (type) => {
    const map = {
      approved: { bg: "#dcfce7", color: "#166534" },
      rejected: { bg: "#fee2e2", color: "#991b1b" },
      pending: { bg: "#fef3c7", color: "#92400e" },
    };
    const s = map[type] || map.pending;
    return { ...s, padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 };
  },
  actionBtn: (color) => ({
    padding: "6px 14px",
    background: color === "green" ? "#dcfce7" : "#fee2e2",
    color: color === "green" ? "#15803d" : "#b91c1c",
    border: `1px solid ${color === "green" ? "#bbf7d0" : "#fecaca"}`,
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.15s",
  }),
  payslipRow: {
    padding: "14px 22px",
    borderBottom: "1px solid #f1f5f9",
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
    alignItems: "center",
    gap: 16,
    fontSize: 13,
    color: "#334155",
  },
  payslipTh: {
    padding: "12px 22px",
    borderBottom: "2px solid #f1f5f9",
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
    gap: 16,
    fontSize: "0.7rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#94a3b8",
    background: "#f8fafc",
  },
  shareCard: {
    background: "#fff",
    padding: 24,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.04)",
  },
  gridTwo: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 24,
    marginTop: 8,
  },
};

export default function RequestPanelContent({ role }) {
  const [activeTab, setActiveTab] = useState("general");
  const [adminRequests, setAdminRequests] = useState([]);
  const [payslipRequests, setPayslipRequests] = useState([]);
  const [sharedDocs, setSharedDocs] = useState([]);
  const [sentDocs, setSentDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payslipLoading, setPayslipLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [hoveredRow, setHoveredRow] = useState(null);

  const userObj = JSON.parse(localStorage.getItem("user")) || {};
  const isAdmin = role === "admin" || role === "super_admin" || role === "admin_hr";
  const isSuperAdmin = role === "super_admin";

  const [shareMode, setShareMode] = useState("file");
  const [selectedFile, setSelectedFile] = useState(null);
  const [docName, setDocName] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [targetRole, setTargetRole] = useState(role === "employee" ? "super_admin" : "employee");
  const [dragOver, setDragOver] = useState(false);
  const [users, setUsers] = useState([]);
  const [targetUserId, setTargetUserId] = useState("");
  const fileInputRef = useRef();

  const [reqType, setReqType] = useState("manpower");
  const [requestForm, setRequestForm] = useState({
    // manpower
    role: "", jd: "", experience: "", skills: "", deadline: "",
    // procurement
    product_name: "", cost: "", vendor: "", procurement_deadline: "",
    from_department: "", to_department: "Operations", qty: "",
    // other
    certificate_name: "", description: "",
    // shared
    target_role: "super_admin", target_user_id: ""
  });

  // Payslip action modal
  const [psModal, setPsModal] = useState(null); // { req, action }
  const [psRejectReason, setPsRejectReason] = useState("");
  const [psUrl, setPsUrl] = useState("");
  const [psSaving, setPsSaving] = useState(false);

  useEffect(() => {
    fetchSharedDocs();
    fetchSentDocs();
    if (isAdmin) {
      fetchAdminRequests();
      fetchUsers();
    }
    if (isSuperAdmin) fetchPayslipRequests();
  }, [role]);

  const fetchUsers = async () => {
    try {
      const res = await api.get("/employees/all-assignable");
      setUsers(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchSharedDocs = async () => {
    setLoading(true);
    try {
      const res = await api.get("/shared-docs/inbox");
      setSharedDocs(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchSentDocs = async () => {
    try {
      const res = await api.get("/shared-docs/sent");
      setSentDocs(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchAdminRequests = async () => {
    try {
      const res = await api.get("/general-requests/admin");
      setAdminRequests(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchPayslipRequests = async () => {
    setPayslipLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/payslip-requests/all`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPayslipRequests(Array.isArray(res.data) ? res.data : []);
    } catch (err) { console.error(err); }
    finally { setPayslipLoading(false); }
  };

  const handleShareFile = async () => {
    if (!selectedFile) return;
    setSubmitting(true);
    setMsg({ type: "", text: "" });
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("document_name", docName || selectedFile.name);
    formData.append("target_role", targetRole);
    formData.append("target_user_id", targetUserId || "");
    formData.append("message", shareMessage);
    try {
      await api.post("/shared-docs/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setMsg({ type: "success", text: "✓ Document shared successfully!" });
      setSelectedFile(null); setDocName(""); setShareMessage("");
      fetchSentDocs();
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.msg || "Failed to share document." });
    } finally { setSubmitting(false); }
  };

  const handleShareLink = async () => {
    if (!driveLink.trim() || !docName.trim()) return;
    setSubmitting(true);
    setMsg({ type: "", text: "" });
    try {
      await api.post("/shared-docs/share-link", { 
        document_name: docName, 
        drive_link: driveLink, 
        target_role: targetRole, 
        target_user_id: targetUserId || null,
        message: shareMessage 
      });
      setMsg({ type: "success", text: "✓ Link shared successfully!" });
      setDriveLink(""); setDocName(""); setShareMessage("");
      fetchSentDocs();
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.msg || "Failed to share link." });
    } finally { setSubmitting(false); }
  };

  const handleGeneralRequest = async () => {
    setSubmitting(true); setMsg({ type: "", text: "" });
    try {
      await api.post("/general-requests", { request_type: reqType, ...requestForm });
      setMsg({ type: "success", text: "✓ Request submitted successfully!" });
      setRequestForm({ role: "", jd: "", experience: "", skills: "", deadline: "", product_name: "", cost: "", vendor: "", procurement_deadline: "", from_department: "", to_department: "Operations", qty: "", certificate_name: "", description: "", target_role: "super_admin", target_user_id: "" });
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.msg || "Failed to submit request." });
    } finally { setSubmitting(false); }
  };

  const handleDownload = async (doc) => {
    if (doc.file_type === "link") { window.open(doc.file_path, "_blank"); return; }
    try {
      const res = await api.get(`/shared-docs/download/${doc.id}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a"); a.href = url; a.download = doc.file_name || doc.document_name || "document"; a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) { setMsg({ type: "error", text: "Download failed." }); }
  };

  const handleStatusChange = async (requestId, newStatus) => {
    try {
      await api.put(`/general-requests/status/${requestId}`, { status: newStatus });
      fetchAdminRequests();
      setMsg({ type: "success", text: `Request ${newStatus} successfully!` });
      setTimeout(() => setMsg({ type: "", text: "" }), 3000);
    } catch (err) { setMsg({ type: "error", text: err.response?.data?.msg || "Failed to update status." }); }
  };

  const handlePayslipAction = async () => {
    if (!psModal) return;
    const { req, action } = psModal;
    if (action === "reject" && !psRejectReason.trim()) { alert("Please provide a rejection reason."); return; }
    setPsSaving(true);
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/payslip-requests/${req.id}`,
        { status: action === "approve" ? "approved" : "rejected", rejection_reason: action === "reject" ? psRejectReason : null, payslip_url: action === "approve" ? psUrl : null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPsModal(null); setPsRejectReason(""); setPsUrl("");
      fetchPayslipRequests();
      setMsg({ type: "success", text: `Payslip request ${action === "approve" ? "approved" : "rejected"} successfully!` });
      setTimeout(() => setMsg({ type: "", text: "" }), 3000);
    } catch (err) { alert(err.response?.data?.msg || "Action failed."); }
    finally { setPsSaving(false); }
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    setSelectedFile(file);
    setDocName(file.name.replace(/\.[^.]+$/, ""));
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const getStatusBadge = (status) => {
    const map = {
      approved: <span style={S.statusBadge("approved")}><CheckCircle size={10} /> Approved</span>,
      rejected: <span style={S.statusBadge("rejected")}><XCircle size={10} /> Rejected</span>,
    };
    return map[status] || <span style={S.statusBadge("pending")}><Clock8 size={10} /> Pending</span>;
  };

  const pendingGeneral = adminRequests.filter(r => r.status === "pending").length;
  const pendingPayslips = payslipRequests.filter(r => r.status === "pending").length;

  const tabs = [
    { id: "general", label: "General", icon: <MessageSquare size={14} />, count: pendingGeneral, color: "amber" },
    ...(isSuperAdmin ? [{ id: "payslips", label: "Payslips", icon: <CreditCard size={14} />, count: pendingPayslips, color: "purple" }] : []),
    { id: "inbox", label: "Inbox / Share", icon: <Inbox size={14} />, count: sharedDocs.length, color: "blue" },
  ];

  return (
    <div style={S.wrapper}>

      {/* ── Tabs ── */}
      <div style={S.tabBar}>
        {tabs.map(t => (
          <button key={t.id} style={S.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
            {t.icon} {t.label}
            {t.count > 0 && <span style={S.badge(t.color)}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── Feedback msg ── */}
      {msg.text && (
        <div style={{
          marginBottom: 16, padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: msg.type === "success" ? "#dcfce7" : "#fee2e2",
          color: msg.type === "success" ? "#166534" : "#991b1b",
          border: `1px solid ${msg.type === "success" ? "#bbf7d0" : "#fecaca"}`,
          display: "flex", alignItems: "center", gap: 8
        }}>
          {msg.type === "success" ? <CheckCircle size={15} /> : <XCircle size={15} />}
          {msg.text}
        </div>
      )}

      {/* ── GENERAL REQUESTS TAB ── */}
      {activeTab === "general" && (
        <div>
          {isAdmin && (
            <div style={S.card}>
              <div style={S.sectionHeader}>
                <span>📥 Incoming General Requests ({adminRequests.length})</span>
                <button onClick={fetchAdminRequests} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "5px 12px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>
              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                {adminRequests.length === 0 ? (
                  <div style={S.emptyState}>
                    <span style={{ fontSize: 32 }}>📭</span>
                    No incoming requests at this time.
                  </div>
                ) : (
                  adminRequests.map((req) => {
                    let parsed = {};
                    try { parsed = JSON.parse(req.description); } catch {}
                    const typeLabel = req.request_type === "manpower" ? "👥 Man Power" : req.request_type === "procurement" ? "📦 Procurement" : "📄 Other";
                    return (
                      <div key={req.id} style={S.reqRow(hoveredRow === req.id)} onMouseEnter={() => setHoveredRow(req.id)} onMouseLeave={() => setHoveredRow(null)}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <FileText size={16} color="#fff" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <strong style={{ fontSize: 14, color: "#1e293b" }}>{req.name}</strong>
                              <span style={{ fontSize: 10, fontWeight: 700, background: "#eef2ff", color: "#4338ca", padding: "2px 7px", borderRadius: 20 }}>{typeLabel}</span>
                            </div>
                            {getStatusBadge(req.status)}
                          </div>
                          {req.request_type === "manpower" && (
                            <div style={{ fontSize: 12, color: "#475569", display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 4 }}>
                              {parsed.jd && <span>📋 JD: {parsed.jd}</span>}
                              {parsed.experience && <span>⏳ Exp: {parsed.experience} yrs</span>}
                              {parsed.skills && <span>🛠 Skills: {parsed.skills}</span>}
                              {parsed.deadline && <span>🗓 Deadline: {parsed.deadline}</span>}
                            </div>
                          )}
                          {req.request_type === "procurement" && (
                            <div style={{ fontSize: 12, color: "#475569", display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 4 }}>
                              {parsed.cost && <span>💰 Cost: ₹{parsed.cost}</span>}
                              {parsed.vendor && <span>🏭 Vendor: {parsed.vendor}</span>}
                              {parsed.qty && <span>📦 Qty: {parsed.qty}</span>}
                              {parsed.from_department && <span>From: {parsed.from_department}</span>}
                              {parsed.to_department && <span>To: {parsed.to_department}</span>}
                              {parsed.deadline && <span>🗓 Deadline: {parsed.deadline}</span>}
                            </div>
                          )}
                          {req.request_type === "other" && (
                            <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>
                              {parsed.description && <span>{parsed.description}</span>}
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#94a3b8" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><User size={10} /> {req.employee_name}</span>
                            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Calendar size={10} /> {new Date(req.created_at).toLocaleDateString("en-GB")}</span>
                          </div>
                        </div>
                        {req.status === "pending" && (
                          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                            <button onClick={() => handleStatusChange(req.id, "approved")} style={S.actionBtn("green")}>✓ Approve</button>
                            <button onClick={() => handleStatusChange(req.id, "rejected")} style={S.actionBtn("red")}>✗ Reject</button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Employee / Admin: submit a new structured request */}
          <div style={S.shareCard}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#1e293b", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <FilePlus size={18} color="#4f46e5" /> New Request
            </div>

            {/* Type selector */}
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {[{id:"manpower",label:"👥 Man Power"},{id:"procurement",label:"📦 Procurement"},{id:"other",label:"📄 Other"}].map(t => (
                <button key={t.id} onClick={() => setReqType(t.id)}
                  style={{ flex:1, padding:"8px 6px", borderRadius:8, border: reqType===t.id ? "2px solid #4f46e5" : "1px solid #e2e8f0", background: reqType===t.id ? "#eef2ff" : "#f8fafc", color: reqType===t.id ? "#4338ca" : "#64748b", fontWeight:700, fontSize:12, cursor:"pointer" }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Man Power fields */}
            {reqType === "manpower" && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                {[["role","Role *","text"],["jd","Job Description","text"],["experience","Experience (Years)","number"],["skills","Skill Set Required","text"],["deadline","Deadline","date"]].map(([k,lbl,tp]) => (
                  <div key={k} style={k==="jd" || k==="skills" ? { gridColumn:"span 2" } : {}}>
                    <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", marginBottom:4 }}>{lbl}</label>
                    <input type={tp} value={requestForm[k]} onChange={e => setRequestForm({...requestForm,[k]:e.target.value})}
                      style={{ width:"100%", padding:"9px 10px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:13, boxSizing:"border-box" }} />
                  </div>
                ))}
              </div>
            )}

            {/* Procurement fields */}
            {reqType === "procurement" && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                {[["product_name","Product Name *","text"],["cost","Cost (₹)","number"],["vendor","Vendor","text"],["qty","Qty *","number"],["from_department","From Department","text"],["to_department","To Department","text"],["procurement_deadline","Deadline","date"]].map(([k,lbl,tp]) => (
                  <div key={k}>
                    <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", marginBottom:4 }}>{lbl}</label>
                    <input type={tp} value={requestForm[k]} onChange={e => setRequestForm({...requestForm,[k]:e.target.value})}
                      style={{ width:"100%", padding:"9px 10px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:13, boxSizing:"border-box" }} />
                  </div>
                ))}
              </div>
            )}

            {/* Other (Certificate) fields */}
            {reqType === "other" && (
              <div style={{ marginBottom:12 }}>
                <div style={{ marginBottom:10 }}>
                  <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", marginBottom:4 }}>Certificate Name *</label>
                  <input type="text" value={requestForm.certificate_name} onChange={e => setRequestForm({...requestForm, certificate_name:e.target.value})}
                    style={{ width:"100%", padding:"9px 10px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:13, boxSizing:"border-box" }} />
                </div>
                <div>
                  <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", marginBottom:4 }}>Description</label>
                  <textarea value={requestForm.description} onChange={e => setRequestForm({...requestForm, description:e.target.value})} rows={3}
                    style={{ width:"100%", padding:"9px 10px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:13, resize:"vertical", boxSizing:"border-box" }} />
                </div>
              </div>
            )}

            {/* Send to */}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", marginBottom:4 }}>Send Request To</label>
              <select value={requestForm.target_role} onChange={e => setRequestForm({...requestForm, target_role:e.target.value})}
                style={{ width:"100%", padding:"9px 10px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:13 }}>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="admin_hr">HR Admin</option>
              </select>
            </div>

            <button onClick={handleGeneralRequest} disabled={submitting}
              style={{ width:"100%", padding:12, background:"linear-gradient(135deg,#10b981,#059669)", color:"#fff", border:"none", borderRadius:8, fontWeight:700, cursor:"pointer", opacity:submitting?0.7:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <Send size={15} /> {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </div>
      )}

      {/* ── PAYSLIP REQUESTS TAB (Super Admin only) ── */}
      {activeTab === "payslips" && isSuperAdmin && (
        <div style={S.card}>
          <div style={{ ...S.sectionHeader, background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }}>
            <span>💳 Payslip Requests ({payslipRequests.length})</span>
            <button onClick={fetchPayslipRequests} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "5px 12px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {payslipLoading ? (
            <div style={S.emptyState}><span style={{ fontSize: 32 }}>⏳</span> Loading payslip requests…</div>
          ) : payslipRequests.length === 0 ? (
            <div style={S.emptyState}><span style={{ fontSize: 32 }}>✅</span> No payslip requests found.</div>
          ) : (
            <>
              <div style={S.payslipTh}>
                <span>Requested By</span>
                <span>Employee</span>
                <span>Month</span>
                <span>Status</span>
                <span>Action</span>
              </div>
              <div style={{ maxHeight: 450, overflowY: "auto" }}>
                {payslipRequests.map((r, i) => (
                  <div key={r.id} style={{
                    ...S.payslipRow,
                    background: i % 2 === 0 ? "#fff" : "#fafafa",
                  }}>
                    <span style={{ fontWeight: 700, color: "#1e293b" }}>{r.admin_name}</span>
                    <span style={{ color: "#475569" }}>{r.employee_name}</span>
                    <span style={{ color: "#64748b", fontWeight: 600 }}>{r.month}</span>
                    <span>{getStatusBadge(r.status)}</span>
                    <div>
                      {r.status === "pending" ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={{ ...S.actionBtn("green"), padding: "5px 10px" }} onClick={() => { setPsModal({ req: r, action: "approve" }); setPsUrl(""); setPsRejectReason(""); }}>✓</button>
                          <button style={{ ...S.actionBtn("red"), padding: "5px 10px" }} onClick={() => { setPsModal({ req: r, action: "reject" }); setPsUrl(""); setPsRejectReason(""); }}>✗</button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>DONE</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── INBOX / SHARE TAB ── */}
      {activeTab === "inbox" && (
        <div style={S.gridTwo}>
          {/* Share Form */}
          <div style={S.shareCard}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#1e293b", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
              <Upload size={18} color="#4f46e5" /> {role === "employee" ? "Send to Super Admin" : "Share with Employee/Team"}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button onClick={() => setShareMode("file")} style={{ flex: 1, padding: 8, borderRadius: 8, border: shareMode === "file" ? "2px solid #4f46e5" : "1px solid #e2e8f0", background: shareMode === "file" ? "#eef2ff" : "#f8fafc", color: shareMode === "file" ? "#4338ca" : "#64748b", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>File</button>
              <button onClick={() => setShareMode("link")} style={{ flex: 1, padding: 8, borderRadius: 8, border: shareMode === "link" ? "2px solid #4f46e5" : "1px solid #e2e8f0", background: shareMode === "link" ? "#eef2ff" : "#f8fafc", color: shareMode === "link" ? "#4338ca" : "#64748b", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Link</button>
            </div>
            {shareMode === "file" ? (
              <div style={{ border: dragOver ? "2px dashed #4f46e5" : "2px dashed #cbd5e1", borderRadius: 10, padding: 20, textAlign: "center", background: dragOver ? "#eef2ff" : "#f8fafc", cursor: "pointer", marginBottom: 12 }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
                {selectedFile ? <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedFile.name}</span> : <span style={{ fontSize: 12, color: "#64748b" }}>Click or drop file here</span>}
                <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={(e) => handleFileSelect(e.target.files[0])} />
              </div>
            ) : (
              <input type="url" placeholder="Drive Link..." value={driveLink} onChange={(e) => setDriveLink(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0", marginBottom: 12, fontSize: 13 }} />
            )}
            <input type="text" placeholder="Document Name..." value={docName} onChange={(e) => setDocName(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0", marginBottom: 12, fontSize: 13 }} />
            {isAdmin && (
              <select 
                value={targetUserId ? `user:${targetUserId}` : targetRole} 
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.startsWith("user:")) {
                    setTargetUserId(val.split(":")[1]);
                    setTargetRole("");
                  } else {
                    setTargetUserId("");
                    setTargetRole(val);
                  }
                }} 
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0", marginBottom: 12, fontSize: 13 }}
              >
                <optgroup label="Role Groups">
                  <option value="all">Everyone (All Roles)</option>
                  <option value="admins">All Administrators (Standard + HR)</option>
                  <option value="employee">Share with Employees</option>
                  <option value="admin_hr">Share with HR Admin</option>
                  <option value="production_admin">Share with Production Admin</option>
                  <option value="intern">Share with Interns</option>
                  <option value="admin">Standard Admins Only</option>
                </optgroup>

                {users.filter(u => u.role === "admin" && u.id !== userObj.id).length > 0 && (
                  <optgroup label="Individual: Standard Admins">
                    {users.filter(u => u.role === "admin" && u.id !== userObj.id).map(u => (
                      <option key={u.id} value={`user:${u.id}`}>{u.fullname || u.username} ({u.username})</option>
                    ))}
                  </optgroup>
                )}

                {users.filter(u => u.role === "admin_hr" && u.id !== userObj.id).length > 0 && (
                  <optgroup label="Individual: HR Admins">
                    {users.filter(u => u.role === "admin_hr" && u.id !== userObj.id).map(u => (
                      <option key={u.id} value={`user:${u.id}`}>{u.fullname || u.username} ({u.username})</option>
                    ))}
                  </optgroup>
                )}

                {users.filter(u => u.role === "employee" && u.id !== userObj.id).length > 0 && (
                  <optgroup label="Individual: Employees">
                    {users.filter(u => u.role === "employee" && u.id !== userObj.id).map(u => (
                      <option key={u.id} value={`user:${u.id}`}>{u.fullname || u.username} ({u.username})</option>
                    ))}
                  </optgroup>
                )}

                {users.filter(u => u.role === "intern" && u.id !== userObj.id).length > 0 && (
                  <optgroup label="Individual: Interns">
                    {users.filter(u => u.role === "intern" && u.id !== userObj.id).map(u => (
                      <option key={u.id} value={`user:${u.id}`}>{u.fullname || u.username} ({u.username})</option>
                    ))}
                  </optgroup>
                )}

                {users.filter(u => u.role === "super_admin" && u.id !== userObj.id).length > 0 && (
                  <optgroup label="Individual: Super Admins">
                    {users.filter(u => u.role === "super_admin" && u.id !== userObj.id).map(u => (
                      <option key={u.id} value={`user:${u.id}`}>{u.fullname || u.username} ({u.username})</option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}
            <button onClick={shareMode === "file" ? handleShareFile : handleShareLink} disabled={submitting}
              style={{ width: "100%", padding: 12, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Sending..." : "Send Document"}
            </button>
          </div>

          {/* Inbox */}
          <div style={S.shareCard}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#1e293b", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
              <Inbox size={18} color="#4f46e5" /> {role === "employee" ? "From Administration" : "Inbox"}
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {sharedDocs.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px", color: "#94a3b8", fontSize: 13 }}>No documents received yet.</div>
              ) : sharedDocs.map(doc => (
                <div key={doc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>{doc.document_name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>From: {doc.shared_by_name} • {new Date(doc.shared_at).toLocaleDateString()}</div>
                  </div>
                  <button onClick={() => handleDownload(doc)} style={{ padding: 6, borderRadius: 6, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#4f46e5", cursor: "pointer" }}><Download size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Payslip Action Modal ── */}
      {psModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}>
          <div style={{ background: "#fff", borderRadius: 20, width: 460, padding: 36, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.2)", border: "1px solid #e2e8f0" }}>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>
              {psModal.action === "approve" ? "✅ Approve Payslip Request" : "✗ Reject Payslip Request"}
            </h3>
            <p style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: 28 }}>
              <strong>{psModal.req.employee_name}</strong> — {psModal.req.month}
            </p>
            {psModal.action === "approve" && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  Payslip URL (optional)
                </label>
                <input value={psUrl} onChange={e => setPsUrl(e.target.value)} placeholder="https://… or leave blank"
                  style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", fontSize: "0.95rem", boxSizing: "border-box", background: "#f8fafc" }} />
                <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 6 }}>Leave blank if using the Payslip Generation module.</p>
              </div>
            )}
            {psModal.action === "reject" && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  Rejection Reason *
                </label>
                <textarea value={psRejectReason} onChange={e => setPsRejectReason(e.target.value)} rows={3} placeholder="Reason for rejection…"
                  style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", fontSize: "0.95rem", resize: "vertical", boxSizing: "border-box", background: "#f8fafc", fontFamily: "inherit" }} />
              </div>
            )}
            <div style={{ display: "flex", gap: 14, justifyContent: "flex-end", marginTop: 32 }}>
              <button style={{ background: "#f1f5f9", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: "0.9rem", cursor: "pointer", color: "#64748b", fontWeight: 700 }} onClick={() => { setPsModal(null); setPsRejectReason(""); setPsUrl(""); }}>Cancel</button>
              <button
                style={{ background: psModal.action === "approve" ? "#059669" : "#dc2626", color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: "0.9rem", fontWeight: 800, cursor: "pointer", opacity: psSaving ? 0.6 : 1, boxShadow: psModal.action === "approve" ? "0 4px 14px rgba(5,150,105,0.3)" : "0 4px 14px rgba(220,38,38,0.3)" }}
                onClick={handlePayslipAction} disabled={psSaving}>
                {psSaving ? "Processing…" : psModal.action === "approve" ? "Confirm Approval" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
