import React, { useState, useEffect } from "react";
import { api } from "../utils/api";
import {
  Send, FileText, Download,
  ExternalLink, Clock, CheckCircle,
  XCircle, AlertCircle, FilePlus,
  Inbox
} from "lucide-react";

const STATUS_COLORS = {
  approved: { bg: "#dcfce7", color: "#166534", label: "Approved" },
  rejected: { bg: "#fee2e2", color: "#991b1b", label: "Rejected" },
  pending: { bg: "#fef3c7", color: "#92400e", label: "Pending" }
};

export default function EmployeeRequestForm() {
  const [inbox, setInbox] = useState([]);
  const [history, setHistory] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const [form, setForm] = useState({
    name: "",
    description: "",
    target_role: "super_admin",
    target_user_id: "",
    format: "pdf"
  });

  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/permissions/admins`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAdmins(res.data);
      } catch (err) {
        console.error("Error fetching admins:", err);
      }
    };
    fetchAdmins();
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [inboxRes, historyRes] = await Promise.all([
        api.get("/shared-docs/inbox"),
        api.get("/requests/my")
      ]);
      setInbox(inboxRes.data);
      setHistory(historyRes.data);
    } catch (err) {
      console.error("Failed to fetch request data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.description) return;

    setSubmitting(true);
    setMsg({ type: "", text: "" });

    try {
      await api.post("/requests", form);
      setMsg({ type: "success", text: "✓ Your request has been submitted successfully!" });
      setForm({ name: "", description: "", target_role: "super_admin", format: "pdf" });

      // Refresh history
      const historyRes = await api.get("/requests/my");
      setHistory(historyRes.data);

      setTimeout(() => setMsg({ type: "", text: "" }), 5000);
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.msg || "Failed to submit request." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (doc) => {
    if (doc.file_type === "link") {
      window.open(doc.file_path, "_blank");
      return;
    }
    try {
      const res = await api.get(`/shared-docs/download/${doc.id}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.document_name || "document";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Download failed.");
    }
  };

  if (loading) return <div className="emp-loading-state">Loading Requests Portal...</div>;

  return (
    <div className="employee-req-portal">
      {msg.text && (
        <div className={`emp-form-msg ${msg.type}`}>
          {msg.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      <div className="emp-req-grid">
        {/* ── LEFT: REQUEST FORM ── */}
        <div className="emp-req-card main-form">
          <div className="emp-card-header">
            <FilePlus size={18} />
            <div>
              <h3>New Request Form</h3>
              <p>Submit a request to Administration</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="emp-styled-form">
            <div className="emp-field">
              <label>What do you need? *</label>
              <input
                type="text"
                placeholder="Enter what you need (e.g., Salary Certificate)..."
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="emp-field">
              <label>Description / Details *</label>
              <textarea
                placeholder="Please provide more details about your request..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                required
                rows={4}
              />
            </div>

            <div className="emp-form-row">
              <div className="emp-field">
                <label>Target Admin</label>
                <select
                  value={form.target_user_id || form.target_role}
                  onChange={e => {
                    const val = e.target.value;
                    const selectedAdmin = admins.find(a => String(a.id) === val);
                    if (selectedAdmin) {
                      setForm({ ...form, target_user_id: selectedAdmin.id, target_role: selectedAdmin.role });
                    } else {
                      // Handle fallback/default roles if any
                      setForm({ ...form, target_user_id: "", target_role: val });
                    }
                  }}
                >
                  <option value="super_admin">Super Admin (Default)</option>
                  <option value="admin">Admin (Default)</option>
                  <option value="admin_hr">HR Admin (Default)</option>

                  {admins.length > 0 && (
                    <optgroup label="Specific Administrators">
                      {admins.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.fullname || a.username} ({a.role === 'admin_hr' ? 'HR' : a.role === 'super_admin' ? 'Super' : 'Admin'})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <div className="emp-field">
                <label>Preferred Format</label>
                <select
                  value={form.format}
                  onChange={e => setForm({ ...form, format: e.target.value })}
                >
                  <option value="pdf">PDF Document</option>
                  <option value="jpg">Image (JPG)</option>
                  <option value="doc">Word/Text</option>
                  <option value="xls">Excel Sheet</option>
                </select>
              </div>
            </div>

            <button type="submit" className="emp-submit-req-btn" disabled={submitting}>
              {submitting ? "Sending..." : "Submit My Request"}
              <Send size={16} />
            </button>
          </form>
        </div>

        {/* ── RIGHT: INBOX & HISTORY ── */}
        <div className="emp-req-right-col">

          {/* Inbox for shared documents */}
          <div className="emp-req-card inbox-card">
            <div className="emp-card-header">
              <Inbox size={18} />
              <div>
                <h3>My Document Inbox</h3>
                <p>Files/Payslips shared with you</p>
              </div>
            </div>

            <div className="emp-mini-list">
              {inbox.length === 0 ? (
                <div className="emp-empty-mini">No documents in your inbox yet.</div>
              ) : (
                inbox.map(doc => (
                  <div key={doc.id} className="emp-mini-item">
                    <div className="item-info">
                      <span className="item-title">{doc.document_name}</span>
                      <span className="item-sub">from {doc.shared_by_name?.split(' ')[0]} • {new Date(doc.shared_at).toLocaleDateString()}</span>
                    </div>
                    <button className="item-btn" onClick={() => handleDownload(doc)}>
                      {doc.file_type === "link" ? <ExternalLink size={14} /> : <Download size={14} />}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Request History */}
          <div className="emp-req-card history-card">
            <div className="emp-card-header">
              <Clock size={18} />
              <div>
                <h3>Request History</h3>
                <p>Track your previous submissions</p>
              </div>
            </div>

            <div className="emp-mini-list">
              {history.length === 0 ? (
                <div className="emp-empty-mini">You haven't made any requests yet.</div>
              ) : (history.map(req => {
                const status = STATUS_COLORS[req.status] || STATUS_COLORS.pending;
                return (
                  <div key={req.id} className="emp-mini-item">
                    <div className="item-info">
                      <span className="item-title">{req.name}</span>
                      <span className="item-sub text-truncate" title={req.description}>{req.description}</span>
                    </div>
                    <span className="item-status" style={{ background: status.bg, color: status.color }}>
                      {status.label}
                    </span>
                  </div>
                );
              }))}
            </div>
          </div>

        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .employee-req-portal { display: flex; flex-direction: column; gap: 20px; color: #1e293b; }
        .emp-req-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; }
        @media (max-width: 900px) { .emp-req-grid { grid-template-columns: 1fr; } }
        
        .emp-req-card { background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .emp-card-header { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 24px; color: #4f46e5; }
        .emp-card-header h3 { margin: 0; font-size: 16px; font-weight: 800; color: #1e293b; }
        .emp-card-header p { margin: 2px 0 0; font-size: 12px; color: #64748b; }
        
        .emp-styled-form { display: flex; flex-direction: column; gap: 16px; }
        .emp-field { display: flex; flex-direction: column; gap: 6px; }
        .emp-field label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.025em; }
        .emp-styled-form select, .emp-styled-form input, .emp-styled-form textarea {
          padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; background: #f8fafc; color: #1e293b; transition: all 0.2s;
        }
        .emp-styled-form select:focus, .emp-styled-form textarea:focus { outline: none; border-color: #4f46e5; background: #fff; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1); }
        .emp-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        
        .emp-submit-req-btn {
          margin-top: 8px; padding: 14px; background: linear-gradient(135deg, #4f46e5, #4338ca); color: #fff; border: none; border-radius: 10px;
          font-weight: 700; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;
        }
        .emp-submit-req-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3); }
        .emp-submit-req-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
        
        .emp-req-right-col { display: flex; flex-direction: column; gap: 24px; }
        .emp-mini-list { display: flex; flex-direction: column; gap: 8px; max-height: 250px; overflow-y: auto; }
        .emp-mini-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f8fafc; border-radius: 10px; border: 1px solid #f1f5f9; }
        .item-info { display: flex; flex-direction: column; min-width: 0; }
        .item-title { font-weight: 700; font-size: 14px; color: #1e293b; }
        .item-sub { font-size: 11px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .text-truncate { max-width: 180px; }
        
        .item-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; color: #4f46e5; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .item-btn:hover { background: #eef2ff; border-color: #4f46e5; }
        .item-status { font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 6px; text-transform: uppercase; }
        
        .emp-form-msg { padding: 12px 16px; border-radius: 12px; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
        .emp-form-msg.success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        .emp-form-msg.error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
        .emp-empty-mini { text-align: center; padding: 20px; color: #94a3b8; font-size: 12px; font-style: italic; }
      ` }} />
    </div>
  );
}
