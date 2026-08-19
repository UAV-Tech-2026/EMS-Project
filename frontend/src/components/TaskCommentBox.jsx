import React, { useState, useRef } from "react";
import { api } from "../utils/api";
import { MessageCircle, Send, AtSign, Shield } from "lucide-react";
import "../styles/TaskManagement.css";

export default function TaskCommentBox({ task, employees = [], currentUserId, onHandoff, inSpreadsheet = false }) {
  const [open,            setOpen]           = useState(false);
  const [comments,        setComments]       = useState([]);
  const [loadingC,        setLoadingC]       = useState(false);
  const [commentText,     setCommentText]    = useState("");
  const [taggedUser,      setTaggedUser]     = useState(null);
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [atSuggestions,   setAtSugg]        = useState([]);
  const [submitting,      setSubmitting]     = useState(false);
  const [cmtError,        setCmtError]       = useState("");
  const inputRef = useRef(null);

  const adminList = (employees || []).filter(e => e.role === "admin" || e.role === "super_admin");

  const loadComments = async () => {
    setLoadingC(true);
    try {
      if (task.isNew || String(task.id).length > 20) return; // Quick guard for spreadsheet draft tasks
      const res = await api.get(`/tasks/${task.id}/comments`);
      setComments(res.data || []);
    } catch { /* silent */ }
    finally { setLoadingC(false); }
  };

  const handleOpen = () => {
    if (task.isNew) {
      alert("Please save the task first before adding comments.");
      return;
    }
    setOpen(o => !o);
    if (!open) loadComments();
  };

  const handleInput = (val) => {
    setCommentText(val);
    setCmtError("");
    const atIdx = val.lastIndexOf("@");
    if (atIdx !== -1) {
      const query = val.slice(atIdx + 1).toLowerCase();
      // Show suggestions immediately when @ is typed
      if (query.length >= 0) {
        const sugg = employees.filter(e =>
          e.id !== currentUserId &&
          (e.fullname?.toLowerCase().includes(query) || e.username?.toLowerCase().includes(query) || query === "")
        );
        setAtSugg(sugg);
        return;
      }
    }
    setAtSugg([]);
  };

  const selectSuggestion = (emp) => {
    const atIdx = commentText.lastIndexOf("@");
    const newText = commentText.slice(0, atIdx) + `@${emp.fullname} `;
    setCommentText(newText);
    setTaggedUser(emp);
    setAtSugg([]);
    inputRef.current?.focus();
  };

  const clearTag = () => {
    setTaggedUser(null);
    setCommentText(prev => prev.replace(new RegExp(`@${taggedUser?.fullname}\\s?`, "g"), "").trim() + " ");
  };

  const handleSubmit = async () => {
    if (!commentText.trim()) { setCmtError("Comment cannot be empty."); return; }
    setSubmitting(true);
    setCmtError("");
    try {
      const payload = {
        comment: commentText.trim(),
        tagged_user_id: taggedUser?.id || null,
        target_admin_id: selectedAdminId ? parseInt(selectedAdminId) : null
      };
      const res = await api.post(`/tasks/${task.id}/comment`, payload);
      setCommentText("");
      setTaggedUser(null);
      setSelectedAdminId("");
      setAtSugg([]);
      loadComments();
      if (res.data.handoff_task_id) {
        onHandoff && onHandoff(task.id);
      }
    } catch (err) {
      setCmtError(err.response?.data?.msg || "Failed to post comment.");
    } finally {
      setSubmitting(false);
    }
  };

  const fmtTime = (dt) => {
    if (!dt) return "";
    const d = new Date(dt);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " " +
           d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  return (
    <div className="tcmt-wrap" onClick={e => e.stopPropagation()} style={inSpreadsheet ? { padding: 0 } : {}}>
      <button className="tcmt-toggle-btn" onClick={handleOpen} title="Comment / Call for Help">
        <MessageCircle size={13} />
        {comments.length > 0 && !open && !inSpreadsheet ? ` ${comments.length}` : ""}
        {!inSpreadsheet && (open ? " Hide" : " Comment / Call for Help")}
      </button>

      {open && (
        <div className="tcmt-box" style={inSpreadsheet ? { position: "absolute", zIndex: 50, right: 0, width: "320px", boxShadow: "0 4px 15px rgba(0,0,0,0.15)", border: "1px solid #cbd5e1" } : {}}>
          <div className="tcmt-thread">
            {loadingC ? (
              <div className="tcmt-loading">Loading…</div>
            ) : comments.length === 0 ? (
              <div className="tcmt-empty">No comments yet. Use @name to tag a colleague for help.</div>
            ) : (
              comments.map(c => {
                const isAdminAuthor = c.author_role === "admin" || c.author_role === "super_admin";
                return (
                  <div key={c.id} className={`tcmt-item ${c.handoff_task_id ? "tcmt-handoff" : ""} ${isAdminAuthor ? "tcmt-admin-comment" : ""}`}>
                    <div className="tcmt-author" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                      <span>
                        {c.author_name}
                        {isAdminAuthor && (
                          <span style={{ marginLeft: 6, fontSize: "10px", background: "#e0e7ff", color: "#4338ca", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>
                            Admin
                          </span>
                        )}
                      </span>
                      <span className="tcmt-time">{fmtTime(c.created_at)}</span>
                    </div>
                    <div className="tcmt-text">{c.comment}</div>
                    {c.target_admin_name && (
                      <div style={{ marginTop: 4, fontSize: "10px", color: "#4f46e5", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                        <Shield size={10} /> Directed to Admin: <strong>{c.target_admin_name}</strong>
                      </div>
                    )}
                    {c.handoff_task_id && (
                      <div className="tcmt-handoff-badge">
                        🔀 Handed off to <strong>{c.tagged_name}</strong> → New Task #{c.handoff_task_id}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          
          <div className="tcmt-input-area">
            {/* Admin Selector Dropdown */}
            <div style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <Shield size={12} color="#4f46e5" />
              <select
                value={selectedAdminId}
                onChange={e => setSelectedAdminId(e.target.value)}
                style={{
                  flex: 1,
                  fontSize: "11px",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  background: selectedAdminId ? "#eef2ff" : "#fff",
                  color: selectedAdminId ? "#4f46e5" : "#475569",
                  fontWeight: selectedAdminId ? "600" : "normal",
                  outline: "none"
                }}
              >
                <option value="">Select Admin to Notify / Direct Comment (Optional)</option>
                {adminList.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.fullname} {a.department ? `(${a.department})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {taggedUser && (
              <div className="tcmt-tag-chip">
                <AtSign size={11} /> {taggedUser.fullname}
                <button className="tcmt-tag-remove" onClick={clearTag}>✕</button>
                <span className="tcmt-tag-hint">→ Task will hand off</span>
              </div>
            )}
            <div style={{ position: "relative" }}>
              <textarea
                ref={inputRef}
                className="tcmt-textarea"
                rows={2}
                placeholder={inSpreadsheet ? "Add comment, @name to hand off" : "Add a comment… type @name to tag & hand off task"}
                value={commentText}
                onChange={e => handleInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !atSuggestions.length) { e.preventDefault(); handleSubmit(); } }}
              />
              {atSuggestions.length > 0 && (
                <div className="tcmt-suggestions" style={{ maxHeight: '160px', overflowY: 'auto' }}>
                  {atSuggestions.map(emp => (
                    <div key={emp.id} className="tcmt-sugg-item" onClick={() => selectSuggestion(emp)} style={{ cursor: "pointer", padding: "4px 8px" }}>
                      <AtSign size={11} /> {emp.fullname} {emp.designation ? `(${emp.designation})` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {cmtError && <div className="tcmt-error" style={{color: 'red', fontSize: '11px'}}>{cmtError}</div>}
            <div className="tcmt-footer" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span className="tcmt-hint" style={{fontSize: '10px'}}>{taggedUser ? `⚠ Submitting hands off task` : (inSpreadsheet ? "Shift+Enter for newline" : "Shift+Enter for new line · Enter to send")}</span>
              <button
                className={`tcmt-send-btn ${taggedUser ? "tcmt-send-handoff" : ""}`}
                style={{display: 'flex', gap: '4px', alignItems: 'center', background: taggedUser ? '#b45309' : '#4f46e5', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer'}}
                onClick={handleSubmit}
                disabled={submitting}
              >
                <Send size={12} />
                {submitting ? "..." : (taggedUser ? "Hand Off" : "Send")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
