import React, { useState, useEffect, useRef } from "react";
import { api } from "../utils/api";
import axios from "axios";
import {
  Send, Calendar, Clock,
  FileText, User, CheckCircle,
  XCircle, Clock8, ThumbsUp, ThumbsDown,
  Upload, FilePlus, X, File, Download, Link2, ExternalLink,
  Inbox, CreditCard, MessageSquare, RefreshCw,
  Users, ShoppingCart, HelpCircle
} from "lucide-react";

const S = {
  wrapper: { padding: "0", fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif" },
  tabBar: { display: "flex", gap: 8, marginBottom: 24, background: "#f1f5f9", borderRadius: 12, padding: 4 },
  tab: (active) => ({
    flex: 1, padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
    fontWeight: 700, fontSize: "0.82rem", display: "flex", alignItems: "center",
    justifyContent: "center", gap: 6, transition: "all 0.2s",
    background: active ? "#fff" : "transparent",
    color: active ? "#4f46e5" : "#64748b",
    boxShadow: active ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
  }),
  badge: (color) => ({
    padding: "2px 7px", borderRadius: 20, fontSize: "0.68rem", fontWeight: 800,
    background: color === "amber" ? "#fef3c7" : color === "purple" ? "#ede9fe" : "#dbeafe",
    color: color === "amber" ? "#92400e" : color === "purple" ? "#5b21b6" : "#1d4ed8",
    marginLeft: 4,
  }),
  sectionHeader: {
    background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
    color: "#fff", padding: "14px 22px", borderRadius: "12px 12px 0 0",
    fontWeight: 800, fontSize: "14px", display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  card: {
    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
    overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.04)", marginBottom: 24,
  },
  emptyState: {
    padding: "48px 32px", textAlign: "center", color: "#94a3b8", fontSize: 13,
    display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
  },
  reqRow: (hover) => ({
    padding: "14px 22px", borderBottom: "1px solid #f1f5f9",
    display: "flex", alignItems: "flex-start", gap: 14,
    transition: "background 0.15s", background: hover ? "#f8fafc" : "#fff",
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
    borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
  }),
  payslipRow: {
    padding: "14px 22px", borderBottom: "1px solid #f1f5f9",
    display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
    alignItems: "center", gap: 16, fontSize: 13, color: "#334155",
  },
  payslipTh: {
    padding: "12px 22px", borderBottom: "2px solid #f1f5f9",
    display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
    gap: 16, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.05em", color: "#94a3b8", background: "#f8fafc",
  },
  shareCard: {
    background: "#fff", padding: 24, borderRadius: 12,
    border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.04)",
  },
  gridTwo: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, marginTop: 8 },
  formField: { marginBottom: 14 },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 },
  input: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit", outline: "none" },
  textarea: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, minHeight: 80, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", outline: "none" },
  submitBtn: { width: "100%", padding: 12, background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14 },
};

const DEPARTMENTS = [
  "PRD-Product Research Department", "PED-Product Engineering Department",
  "PDD-Software", "PDD-I&TT", "PDD-FT&T", "PDD-PTI",
  "PMT", "BMD", "HR", "Operations"
];

const ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel", "text/plain", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ALLOWED_EXTENSIONS = ".jpg,.jpeg,.png,.gif,.webp,.pdf,.xlsx,.xls,.txt,.doc,.docx";
const ALLOWED_LABEL = "Images, PDF, Excel (.xlsx/.xls), Word (.doc/.docx), Text (.txt)";

// Parse description JSON safely
function parseDesc(desc) {
  try { return JSON.parse(desc); } catch { return {}; }
}

// Render request card details based on request_type
function RequestDetails({ req }) {
  const d = parseDesc(req.description);
  const type = req.request_type || req.format;

  if (type === "manpower") {
    return (
      <div style={{ fontSize: 12, color: "#475569", marginTop: 6, display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
        {d.role && <span><b>Role:</b> {d.role}</span>}
        {d.experience && <span><b>Exp:</b> {d.experience} yrs</span>}
        {d.skills && <span><b>Skills:</b> {d.skills}</span>}
        {d.deadline && <span><b>Deadline:</b> {d.deadline}</span>}
        {d.jd && <div style={{ width: "100%", marginTop: 4 }}><b>JD:</b> {d.jd}</div>}
      </div>
    );
  }
  if (type === "procurement") {
    return (
      <div style={{ fontSize: 12, color: "#475569", marginTop: 6, display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
        {d.product_name && <span><b>Product:</b> {d.product_name}</span>}
        {d.qty && <span><b>Qty:</b> {d.qty}</span>}
        {d.cost && <span><b>Cost:</b> ₹{d.cost}</span>}
        {d.vendor && <span><b>Vendor:</b> {d.vendor}</span>}
        {d.from_department && <span><b>From:</b> {d.from_department}</span>}
        {d.to_department && <span><b>To:</b> {d.to_department}</span>}
        {d.deadline && <span><b>Deadline:</b> {d.deadline}</span>}
      </div>
    );
  }
  if (type === "other") {
    return (
      <div style={{ fontSize: 12, color: "#475569", marginTop: 6 }}>
        {d.certificate_name && <span><b>Certificate:</b> {d.certificate_name}</span>}
        {d.description && <div style={{ marginTop: 4 }}>{d.description}</div>}
      </div>
    );
  }
  // legacy
  return <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{req.description}</div>;
}

function TypeBadge({ type }) {
  const map = {
    manpower:    { bg: "#dbeafe", color: "#1d4ed8", label: "Man Power" },
    procurement: { bg: "#fef9c3", color: "#92400e", label: "Procurement" },
    other:       { bg: "#f3e8ff", color: "#7c3aed", label: "Other" },
  };
  const s = map[type] || { bg: "#f1f5f9", color: "#475569", label: type || "General" };
  return (
    <span style={{ ...s, padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
      {s.label}
    </span>
  );
}

export default function RequestPanelContent({ role }) {
  const [activeTab, setActiveTab] = useState("manpower");
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

  // Inbox/Share state
  const [shareMode, setShareMode] = useState("file");
  const [selectedFile, setSelectedFile] = useState(null);
  const [docName, setDocName] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [targetRole, setTargetRole] = useState(role === "employee" ? "super_admin" : "employee");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef();
  const [enrolledRoles, setEnrolledRoles] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);

  // Man Power form
  const [mpForm, setMpForm] = useState({ role: "", jd: "", experience: "", skills: "", deadline: "", target_admin_id: "" });

  // Procurement form
  const [pcForm, setPcForm] = useState({
    product_name: "", cost: "", vendor: "",
    procurement_deadline: "", from_department: userObj.department || "",
    to_department: "Operations", qty: "", target_admin_id: ""
  });

  // Other form
  const [otForm, setOtForm] = useState({ certificate_name: "", description: "", format: "pdf", target_admin_id: "" });

  // Payslip modal
  const [psModal, setPsModal] = useState(null);
  const [psRejectReason, setPsRejectReason] = useState("");
  const [psUrl, setPsUrl] = useState("");
  const [psSaving, setPsSaving] = useState(false);

  useEffect(() => {
    fetchSharedDocs();
    fetchSentDocs();
    if (isAdmin) fetchAdminRequests();
    if (isSuperAdmin) fetchPayslipRequests();
    if (isAdmin) fetchEnrolledRoles();
    if (!isAdmin) fetchAdminUsers();
  }, [role]);

  const fetchEnrolledRoles = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/auth/users`, { headers: { Authorization: `Bearer ${token}` } });
      const users = Array.isArray(res.data?.users) ? res.data.users : [];
      const roles = [...new Set(users.map(u => u.role))].filter(r => r && r !== "super_admin");
      setEnrolledRoles(roles);
      if (roles.length > 0 && role !== "employee") setTargetRole(roles[0]);
    } catch (err) { console.error(err); }
  };

  const fetchAdminUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/auth/users`, { headers: { Authorization: `Bearer ${token}` } });
      const users = Array.isArray(res.data?.users) ? res.data.users : [];
      const admins = users
        .filter(u => ["admin", "admin_hr", "super_admin"].includes(u.role))
        .map(u => ({ id: u.id, fullname: u.fullname || "Admin", role: u.role, department: u.department || null }));
      setAdminUsers(admins);
      const defaultAdmin = admins.find(a => a.role === "super_admin") || admins[0];
      if (defaultAdmin) {
        const id = String(defaultAdmin.id);
        setMpForm(p => ({ ...p, target_admin_id: id }));
        setPcForm(p => ({ ...p, target_admin_id: id }));
        setOtForm(p => ({ ...p, target_admin_id: id }));
      }
    } catch (err) { console.error(err); }
  };

  const roleLabel = (r) => {
    const map = { employee: "Share with Employees", admin: "Share with Admin", admin_hr: "Share with HR Admin", intern: "Share with Interns", all: "Everyone" };
    return map[r] || `Share with ${r}`;
  };

  const fetchSharedDocs = async () => {
    setLoading(true);
    try { const res = await api.get("/shared-docs/inbox"); setSharedDocs(res.data); }
    catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchSentDocs = async () => {
    try { const res = await api.get("/shared-docs/sent"); setSentDocs(res.data); }
    catch (err) { console.error(err); }
  };

  const fetchAdminRequests = async () => {
    try { const res = await api.get("/general-requests/admin"); setAdminRequests(res.data); }
    catch (err) { console.error(err); }
  };

  const fetchPayslipRequests = async () => {
    setPayslipLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/payslip-requests/all`, { headers: { Authorization: `Bearer ${token}` } });
      setPayslipRequests(Array.isArray(res.data) ? res.data : []);
    } catch (err) { console.error(err); } finally { setPayslipLoading(false); }
  };

  const getAdminTargetInfo = (adminId) => {
    const a = adminUsers.find(x => String(x.id) === String(adminId));
    return a ? { target_user_id: a.id, target_role: a.role } : { target_role: "super_admin" };
  };

  const handleManpowerSubmit = async () => {
    if (!mpForm.role || !mpForm.deadline) { setMsg({ type: "error", text: "Role and deadline are required." }); return; }
    setSubmitting(true); setMsg({ type: "", text: "" });
    try {
      const target = getAdminTargetInfo(mpForm.target_admin_id);
      await api.post("/general-requests", { request_type: "manpower", ...mpForm, ...target });
      setMsg({ type: "success", text: "✓ Man Power Request submitted!" });
      setMpForm(p => ({ role: "", jd: "", experience: "", skills: "", deadline: "", target_admin_id: p.target_admin_id }));
      setTimeout(() => setMsg({ type: "", text: "" }), 4000);
    } catch (err) { setMsg({ type: "error", text: err.response?.data?.msg || "Failed to submit." }); }
    finally { setSubmitting(false); }
  };

  const handleProcurementSubmit = async () => {
    if (!pcForm.product_name || !pcForm.qty) { setMsg({ type: "error", text: "Product name and qty are required." }); return; }
    setSubmitting(true); setMsg({ type: "", text: "" });
    try {
      const target = getAdminTargetInfo(pcForm.target_admin_id);
      await api.post("/general-requests", { request_type: "procurement", ...pcForm, ...target });
      setMsg({ type: "success", text: "✓ Procurement Request submitted!" });
      setPcForm(p => ({ product_name: "", cost: "", vendor: "", procurement_deadline: "", from_department: userObj.department || "", to_department: "Operations", qty: "", target_admin_id: p.target_admin_id }));
      setTimeout(() => setMsg({ type: "", text: "" }), 4000);
    } catch (err) { setMsg({ type: "error", text: err.response?.data?.msg || "Failed to submit." }); }
    finally { setSubmitting(false); }
  };

  const handleOtherSubmit = async () => {
    if (!otForm.certificate_name) { setMsg({ type: "error", text: "Certificate name is required." }); return; }
    setSubmitting(true); setMsg({ type: "", text: "" });
    try {
      const target = getAdminTargetInfo(otForm.target_admin_id);
      await api.post("/general-requests", { request_type: "other", ...otForm, ...target });
      setMsg({ type: "success", text: "✓ Request submitted!" });
      setOtForm(p => ({ certificate_name: "", description: "", format: "pdf", target_admin_id: p.target_admin_id }));
      setTimeout(() => setMsg({ type: "", text: "" }), 4000);
    } catch (err) { setMsg({ type: "error", text: err.response?.data?.msg || "Failed to submit." }); }
    finally { setSubmitting(false); }
  };

  const handleShareFile = async () => {
    if (!selectedFile) return;
    setSubmitting(true); setMsg({ type: "", text: "" });
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("document_name", docName || selectedFile.name);
    formData.append("target_role", targetRole);
    formData.append("message", shareMessage);
    try {
      await api.post("/shared-docs/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setMsg({ type: "success", text: "✓ Document shared successfully!" });
      setSelectedFile(null); setDocName(""); setShareMessage("");
      fetchSentDocs();
    } catch (err) { setMsg({ type: "error", text: err.response?.data?.msg || "Failed to share." }); }
    finally { setSubmitting(false); }
  };

  const handleShareLink = async () => {
    if (!driveLink.trim() || !docName.trim()) return;
    setSubmitting(true); setMsg({ type: "", text: "" });
    try {
      await api.post("/shared-docs/share-link", { document_name: docName, drive_link: driveLink, target_role: targetRole, message: shareMessage });
      setMsg({ type: "success", text: "✓ Link shared successfully!" });
      setDriveLink(""); setDocName(""); setShareMessage("");
      fetchSentDocs();
    } catch (err) { setMsg({ type: "error", text: err.response?.data?.msg || "Failed to share." }); }
    finally { setSubmitting(false); }
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
    if (!ALLOWED_MIME_TYPES.includes(file.type)) { setMsg({ type: "error", text: `❌ File type not allowed. Accepted: ${ALLOWED_LABEL}` }); return; }
    setMsg({ type: "", text: "" }); setSelectedFile(file); setDocName(file.name.replace(/\.[^.]+$/, ""));
  };

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) handleFileSelect(file); };

  const getStatusBadge = (status) => {
    const map = {
      approved: <span style={S.statusBadge("approved")}><CheckCircle size={10} /> Approved</span>,
      rejected: <span style={S.statusBadge("rejected")}><XCircle size={10} /> Rejected</span>,
    };
    return map[status] || <span style={S.statusBadge("pending")}><Clock8 size={10} /> Pending</span>;
  };

  const pendingRequests = adminRequests.filter(r => r.status === "pending").length;
  const pendingPayslips = payslipRequests.filter(r => r.status === "pending").length;

  // Admin-side: filter requests by type
  const manpowerReqs    = adminRequests.filter(r => r.request_type === "manpower"    || r.format === "manpower");
  const procurementReqs = adminRequests.filter(r => r.request_type === "procurement" || r.format === "procurement");
  const otherReqs       = adminRequests.filter(r => r.request_type === "other"       || (!["manpower","procurement","payslip"].includes(r.request_type) && !["manpower","procurement"].includes(r.format)));

  const tabs = [
    { id: "manpower",    label: "Man Power Request",   icon: <Users size={14} />,        count: isAdmin ? manpowerReqs.filter(r=>r.status==="pending").length : 0,    color: "amber"  },
    { id: "procurement", label: "Procurement Request", icon: <ShoppingCart size={14} />, count: isAdmin ? procurementReqs.filter(r=>r.status==="pending").length : 0, color: "purple" },
    { id: "other",       label: "Other Request",       icon: <HelpCircle size={14} />,   count: isAdmin ? otherReqs.filter(r=>r.status==="pending").length : 0,        color: "blue"   },
  ];

  // Shared admin-side request list renderer
  const renderAdminRequestList = (requests, emptyLabel) => (
    <div style={S.card}>
      <div style={S.sectionHeader}>
        <span>Incoming {emptyLabel} ({requests.length})</span>
        <button onClick={fetchAdminRequests} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "5px 12px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>
      {requests.length === 0 ? (
        <div style={S.emptyState}><span style={{ fontSize: 32 }}>📭</span> No {emptyLabel.toLowerCase()} at this time.</div>
      ) : requests.map((r, i) => (
        <div
          key={r.id}
          style={S.reqRow(hoveredRow === r.id)}
          onMouseEnter={() => setHoveredRow(r.id)}
          onMouseLeave={() => setHoveredRow(null)}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <TypeBadge type={r.request_type || r.format} />
              <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{r.employee_name}</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
            <RequestDetails req={r} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            {getStatusBadge(r.status)}
            {r.status === "pending" && (
              <div style={{ display: "flex", gap: 6 }}>
                <button style={S.actionBtn("green")} onClick={() => handleStatusChange(r.id, "approved")}>✓ Approve</button>
                <button style={S.actionBtn("red")} onClick={() => handleStatusChange(r.id, "rejected")}>✗ Reject</button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  // Admin selector dropdown (shared by all 3 forms)
  const AdminSelector = ({ value, onChange }) => (
    <div style={S.formField}>
      <label style={S.label}>Send To</label>
      {adminUsers.length === 0 ? (
        <div style={{ ...S.input, color: "#94a3b8", background: "#f8fafc" }}>Loading admins…</div>
      ) : (
        <select value={value} onChange={e => onChange(e.target.value)} style={S.input}>
          {adminUsers.map(a => {
            const roleTag = a.role === "super_admin" ? "Super Admin" : a.role === "admin_hr" ? "HR Admin" : "Admin";
            const deptTag = a.department ? ` · ${a.department}` : "";
            return <option key={a.id} value={String(a.id)}>{a.fullname} ({roleTag}{deptTag})</option>;
          })}
        </select>
      )}
    </div>
  );

  return (
    <div style={S.wrapper}>

      {/* Tab Bar */}
      <div style={S.tabBar}>
        {tabs.map(t => (
          <button key={t.id} style={S.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
            {t.icon} {t.label}
            {t.count > 0 && <span style={S.badge(t.color)}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Message */}
      {msg.text && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: msg.type === "success" ? "#dcfce7" : "#fee2e2", color: msg.type === "success" ? "#166534" : "#991b1b", border: `1px solid ${msg.type === "success" ? "#bbf7d0" : "#fecaca"}`, display: "flex", alignItems: "center", gap: 8 }}>
          {msg.type === "success" ? <CheckCircle size={15} /> : <XCircle size={15} />} {msg.text}
        </div>
      )}

      {/* ── TAB: MAN POWER REQUEST ─────────────────────────────────── */}
      {activeTab === "manpower" && (
        <>
          {isAdmin ? renderAdminRequestList(manpowerReqs, "Man Power Requests") : (
            <div style={S.shareCard}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#1e293b", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={18} color="#4f46e5" /> Man Power Request
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={S.formField}>
                  <label style={S.label}>Role Required *</label>
                  <input style={S.input} placeholder="e.g. Software Engineer" value={mpForm.role} onChange={e => setMpForm(p => ({ ...p, role: e.target.value }))} />
                </div>
                <div style={S.formField}>
                  <label style={S.label}>Experience (Years)</label>
                  <input style={S.input} type="number" min="0" placeholder="e.g. 2" value={mpForm.experience} onChange={e => setMpForm(p => ({ ...p, experience: e.target.value }))} />
                </div>
              </div>

              <div style={S.formField}>
                <label style={S.label}>Job Description</label>
                <textarea style={S.textarea} placeholder="Describe the responsibilities and requirements..." value={mpForm.jd} onChange={e => setMpForm(p => ({ ...p, jd: e.target.value }))} />
              </div>

              <div style={S.formField}>
                <label style={S.label}>Skill Set Required</label>
                <input style={S.input} placeholder="e.g. React, Node.js, PostgreSQL" value={mpForm.skills} onChange={e => setMpForm(p => ({ ...p, skills: e.target.value }))} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={S.formField}>
                  <label style={S.label}>Deadline *</label>
                  <input style={S.input} type="date" value={mpForm.deadline} onChange={e => setMpForm(p => ({ ...p, deadline: e.target.value }))} />
                </div>
                <AdminSelector value={mpForm.target_admin_id} onChange={v => setMpForm(p => ({ ...p, target_admin_id: v }))} />
              </div>

              <button style={{ ...S.submitBtn, opacity: submitting ? 0.7 : 1 }} onClick={handleManpowerSubmit} disabled={submitting}>
                <Send size={15} /> {submitting ? "Submitting..." : "Submit Man Power Request"}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── TAB: PROCUREMENT REQUEST ───────────────────────────────── */}
      {activeTab === "procurement" && (
        <>
          {isAdmin ? renderAdminRequestList(procurementReqs, "Procurement Requests") : (
            <div style={S.shareCard}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#1e293b", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <ShoppingCart size={18} color="#4f46e5" /> Procurement Request
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={S.formField}>
                  <label style={S.label}>Product Name *</label>
                  <input style={S.input} placeholder="e.g. Laptop" value={pcForm.product_name} onChange={e => setPcForm(p => ({ ...p, product_name: e.target.value }))} />
                </div>
                <div style={S.formField}>
                  <label style={S.label}>Quantity *</label>
                  <input style={S.input} type="number" min="1" placeholder="e.g. 5" value={pcForm.qty} onChange={e => setPcForm(p => ({ ...p, qty: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={S.formField}>
                  <label style={S.label}>Cost (₹)</label>
                  <input style={S.input} type="number" min="0" placeholder="e.g. 50000" value={pcForm.cost} onChange={e => setPcForm(p => ({ ...p, cost: e.target.value }))} />
                </div>
                <div style={S.formField}>
                  <label style={S.label}>Vendor</label>
                  <input style={S.input} placeholder="e.g. Dell India" value={pcForm.vendor} onChange={e => setPcForm(p => ({ ...p, vendor: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={S.formField}>
                  <label style={S.label}>From Department</label>
                  <select style={S.input} value={pcForm.from_department} onChange={e => setPcForm(p => ({ ...p, from_department: e.target.value }))}>
                    <option value="">Select Department</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div style={S.formField}>
                  <label style={S.label}>To Department</label>
                  <select style={S.input} value={pcForm.to_department} onChange={e => setPcForm(p => ({ ...p, to_department: e.target.value }))}>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={S.formField}>
                  <label style={S.label}>Deadline Date</label>
                  <input style={S.input} type="date" value={pcForm.procurement_deadline} onChange={e => setPcForm(p => ({ ...p, procurement_deadline: e.target.value }))} />
                </div>
                <AdminSelector value={pcForm.target_admin_id} onChange={v => setPcForm(p => ({ ...p, target_admin_id: v }))} />
              </div>

              <button style={{ ...S.submitBtn, background: "linear-gradient(135deg, #f59e0b, #d97706)", opacity: submitting ? 0.7 : 1 }} onClick={handleProcurementSubmit} disabled={submitting}>
                <Send size={15} /> {submitting ? "Submitting..." : "Submit Procurement Request"}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── TAB: OTHER REQUEST ─────────────────────────────────────── */}
      {activeTab === "other" && (
        <>
          {isAdmin ? renderAdminRequestList(otherReqs, "Other Requests") : (
            <div style={S.shareCard}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#1e293b", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <HelpCircle size={18} color="#7c3aed" /> Other Request
              </div>

              <div style={S.formField}>
                <label style={S.label}>Certificate / Request Name *</label>
                <input style={S.input} placeholder="e.g. Experience Certificate, NOC Letter..." value={otForm.certificate_name} onChange={e => setOtForm(p => ({ ...p, certificate_name: e.target.value }))} />
              </div>

              <div style={S.formField}>
                <label style={S.label}>Description</label>
                <textarea style={S.textarea} placeholder="Add any details or context for this request..." value={otForm.description} onChange={e => setOtForm(p => ({ ...p, description: e.target.value }))} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={S.formField}>
                  <label style={S.label}>Preferred Format</label>
                  <select style={S.input} value={otForm.format} onChange={e => setOtForm(p => ({ ...p, format: e.target.value }))}>
                    <option value="pdf">PDF Document</option>
                    <option value="jpg">JPG Image</option>
                    <option value="png">PNG Image</option>
                    <option value="doc">Word DOC</option>
                    <option value="xls">Excel XLS</option>
                  </select>
                </div>
                <AdminSelector value={otForm.target_admin_id} onChange={v => setOtForm(p => ({ ...p, target_admin_id: v }))} />
              </div>

              <button style={{ ...S.submitBtn, background: "linear-gradient(135deg, #7c3aed, #4f46e5)", opacity: submitting ? 0.7 : 1 }} onClick={handleOtherSubmit} disabled={submitting}>
                <Send size={15} /> {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          )}
        </>
      )}

      {/* Payslip modal */}
      {psModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}>
          <div style={{ background: "#fff", borderRadius: 20, width: 460, padding: 36, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.2)", border: "1px solid #e2e8f0" }}>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>
              {psModal.action === "approve" ? "✅ Approve Payslip Request" : "✗ Reject Payslip Request"}
            </h3>
            <p style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: 28 }}>
              <strong>{psModal.req.employee_name}</strong> — {psModal.req.month}
            </p>
            {psModal.action === "approve" && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Payslip URL (optional)</label>
                <input value={psUrl} onChange={e => setPsUrl(e.target.value)} placeholder="https://… or leave blank"
                  style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", fontSize: "0.95rem", boxSizing: "border-box", background: "#f8fafc" }} />
              </div>
            )}
            {psModal.action === "reject" && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Rejection Reason *</label>
                <textarea value={psRejectReason} onChange={e => setPsRejectReason(e.target.value)} rows={3} placeholder="Reason for rejection…"
                  style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", fontSize: "0.95rem", resize: "vertical", boxSizing: "border-box", background: "#f8fafc", fontFamily: "inherit" }} />
              </div>
            )}
            <div style={{ display: "flex", gap: 14, justifyContent: "flex-end", marginTop: 32 }}>
              <button style={{ background: "#f1f5f9", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: "0.9rem", cursor: "pointer", color: "#64748b", fontWeight: 700 }}
                onClick={() => { setPsModal(null); setPsRejectReason(""); setPsUrl(""); }}>Cancel</button>
              <button style={{ background: psModal.action === "approve" ? "#059669" : "#dc2626", color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: "0.9rem", fontWeight: 800, cursor: "pointer", opacity: psSaving ? 0.6 : 1 }}
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
