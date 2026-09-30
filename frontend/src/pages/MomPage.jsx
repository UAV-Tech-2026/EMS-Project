import React, { useState, useEffect } from "react";
import { api, API_URL } from "../utils/api";
import {
  FileText,
  Plus,
  Trash2,
  Download,
  Save,
  FileCheck,
  RefreshCw,
  Clock,
  User,
  Calendar,
  Layers,
  ArrowLeft,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

export default function MomPage({ onClose }) {
  const user = JSON.parse(sessionStorage.getItem("user") || "{}");

  // Document types state
  const [docTypes, setDocTypes] = useState([
    { id: "MOM", label: "Document Template", available: true },
    { id: "PROJECT_REPORT", label: "Project Report (Coming Soon)", available: false },
    { id: "DAILY_REPORT", label: "Daily Report (Coming Soon)", available: false },
    { id: "WEEKLY_REPORT", label: "Weekly Report (Coming Soon)", available: false },
    { id: "MEETING_REPORT", label: "Meeting Report (Coming Soon)", available: false }
  ]);
  const [selectedDocType, setSelectedDocType] = useState("MOM");

  // List of existing MOM documents
  const [moms, setMoms] = useState([]);
  const [loadingMoms, setLoadingMoms] = useState(true);

  // Form State
  const [activeMomId, setActiveMomId] = useState(null);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [meetingDuration, setMeetingDuration] = useState("1 Hour");
  const [organizer, setOrganizer] = useState(user.fullname || user.name || user.username || "");
  const [attendees, setAttendees] = useState([""]);
  const [newAttendeeName, setNewAttendeeName] = useState("");
  const [agenda, setAgenda] = useState("");
  const [summary, setSummary] = useState("");
  const [actionItems, setActionItems] = useState([
    { task: "", assignee: "", dueDate: "" }
  ]);

  // Status & Feedback
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", text: "" });

  useEffect(() => {
    fetchDocTypes();
    fetchMoms();
  }, []);

  const fetchDocTypes = async () => {
    try {
      const res = await api.get("/mom/types");
      if (res.data && res.data.types) {
        setDocTypes(res.data.types);
      }
    } catch (err) {
      console.warn("Could not load doc types registry:", err);
    }
  };

  const fetchMoms = async () => {
    setLoadingMoms(true);
    try {
      const res = await api.get("/mom");
      setMoms(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load MOM list:", err);
    } finally {
      setLoadingMoms(false);
    }
  };

  const resetForm = () => {
    setActiveMomId(null);
    setMeetingTitle("");
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setMeetingDate(now.toISOString().slice(0, 16));
    setMeetingDuration("1 Hour");
    setOrganizer(user.fullname || user.name || user.username || "");
    setAttendees([""]);
    setAgenda("");
    setSummary("");
    setActionItems([{ task: "", assignee: "", dueDate: "" }]);
    setFeedback({ type: "", text: "" });
  };

  const loadMomIntoForm = (mom) => {
    setActiveMomId(mom.id);
    setSelectedDocType(mom.document_type || "MOM");
    setMeetingTitle(mom.meeting_title || "");
    
    if (mom.meeting_date) {
      const d = new Date(mom.meeting_date);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      setMeetingDate(d.toISOString().slice(0, 16));
    }

    setMeetingDuration(mom.meeting_duration || "1 Hour");
    setOrganizer(mom.organizer || "");

    const parsedAttendees = Array.isArray(mom.attendees)
      ? mom.attendees
      : (typeof mom.attendees === "string" ? JSON.parse(mom.attendees || "[]") : []);
    setAttendees(parsedAttendees.length > 0 ? parsedAttendees : [""]);

    setAgenda(mom.agenda || "");
    setSummary(mom.summary || "");

    const parsedActions = Array.isArray(mom.action_items)
      ? mom.action_items
      : (typeof mom.action_items === "string" ? JSON.parse(mom.action_items || "[]") : []);
    setActionItems(parsedActions.length > 0 ? parsedActions : [{ task: "", assignee: "", dueDate: "" }]);

    setFeedback({ type: "info", text: `Loaded draft: "${mom.meeting_title}"` });
  };

  // Attendees Handlers
  const handleAddAttendee = () => {
    if (!newAttendeeName.trim()) return;
    setAttendees(prev => [...prev.filter(a => a.trim() !== ""), newAttendeeName.trim()]);
    setNewAttendeeName("");
  };

  const handleRemoveAttendee = (index) => {
    setAttendees(prev => prev.filter((_, i) => i !== index));
  };

  // Action Items Handlers
  const handleAddActionItem = () => {
    setActionItems(prev => [...prev, { task: "", assignee: "", dueDate: "" }]);
  };

  const handleUpdateActionItem = (index, field, value) => {
    setActionItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveActionItem = (index) => {
    setActionItems(prev => prev.filter((_, i) => i !== index));
  };

  // Save Draft Handler
  const handleSaveDraft = async () => {
    if (!meetingTitle.trim()) {
      setFeedback({ type: "error", text: "Please enter a Meeting Title first." });
      return;
    }

    setSaving(true);
    setFeedback({ type: "", text: "" });

    const cleanAttendees = attendees.filter(a => typeof a === "string" ? a.trim() !== "" : true);
    const cleanActionItems = actionItems.filter(item => item.task && item.task.trim() !== "");

    const payload = {
      document_type: selectedDocType,
      meeting_title: meetingTitle,
      meeting_date: meetingDate,
      meeting_duration: meetingDuration,
      organizer,
      attendees: cleanAttendees,
      agenda,
      summary,
      action_items: cleanActionItems,
      status: "Draft"
    };

    try {
      let savedRecord;
      if (activeMomId) {
        const res = await api.put(`/mom/${activeMomId}`, payload);
        savedRecord = res.data;
        setFeedback({ type: "success", text: "✓ MOM Draft updated successfully!" });
      } else {
        const res = await api.post("/mom", payload);
        savedRecord = res.data;
        setActiveMomId(savedRecord.id);
        setFeedback({ type: "success", text: "✓ New MOM Draft saved successfully!" });
      }
      fetchMoms();
    } catch (err) {
      console.error("Save draft error:", err);
      setFeedback({ type: "error", text: err.response?.data?.msg || "Failed to save draft." });
    } finally {
      setSaving(false);
    }
  };

  // Generate PDF Handler
  const handleGeneratePdf = async () => {
    if (!meetingTitle.trim()) {
      setFeedback({ type: "error", text: "Please enter a Meeting Title before generating PDF." });
      return;
    }

    setGeneratingPdf(true);
    setFeedback({ type: "", text: "" });

    try {
      // 1. Ensure latest changes are saved first
      const cleanAttendees = attendees.filter(a => typeof a === "string" ? a.trim() !== "" : true);
      const cleanActionItems = actionItems.filter(item => item.task && item.task.trim() !== "");

      const payload = {
        document_type: selectedDocType,
        meeting_title: meetingTitle,
        meeting_date: meetingDate,
        meeting_duration: meetingDuration,
        organizer,
        attendees: cleanAttendees,
        agenda,
        summary,
        action_items: cleanActionItems,
        status: "Generated"
      };

      let currentId = activeMomId;
      if (currentId) {
        await api.put(`/mom/${currentId}`, payload);
      } else {
        const saveRes = await api.post("/mom", payload);
        currentId = saveRes.data.id;
        setActiveMomId(currentId);
      }

      // 2. Request PDF Generation
      const pdfRes = await api.post(`/mom/${currentId}/generate-pdf`);
      
      setFeedback({ type: "success", text: "🎉 MOM PDF generated successfully! Opening preview..." });
      fetchMoms();

      // Open PDF in new tab
      const token = sessionStorage.getItem("token");
      const pdfWindowUrl = `${API_URL}/api/mom/${currentId}/pdf?token=${token}`;
      window.open(pdfWindowUrl, "_blank");

    } catch (err) {
      console.error("Generate PDF error:", err);
      setFeedback({ type: "error", text: err.response?.data?.msg || "PDF generation failed." });
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Delete MOM Handler
  const handleDeleteMom = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete MOM: "${title}"?`)) return;
    try {
      await api.delete(`/mom/${id}`);
      if (activeMomId === id) resetForm();
      fetchMoms();
    } catch (err) {
      alert("Failed to delete MOM document.");
    }
  };

  // Direct PDF Download / View
  const handleViewPdf = (momId) => {
    const token = sessionStorage.getItem("token");
    window.open(`${API_URL}/api/mom/${momId}/pdf?token=${token}`, "_blank");
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "10px 15px", fontFamily: "sans-serif" }}>
      {/* Header Banner */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)",
        color: "#fff", padding: "20px 24px", borderRadius: 14, marginBottom: 24,
        boxShadow: "0 10px 25px rgba(79, 70, 229, 0.2)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: "rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <FileText size={26} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Document Template</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.9 }}>
              Create, edit, store, and generate PDF Document Templates formatted to company specification
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.2)", border: "none", color: "#fff",
              padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6, fontSize: 13
            }}
          >
            <ArrowLeft size={16} /> Back
          </button>
        )}
      </div>

      {/* Feedback Alert */}
      {feedback.text && (
        <div style={{
          padding: "12px 18px", borderRadius: 10, marginBottom: 20, fontSize: 14, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 10,
          background: feedback.type === "success" ? "#ecfdf5" : feedback.type === "error" ? "#fef2f2" : "#eff6ff",
          color: feedback.type === "success" ? "#065f46" : feedback.type === "error" ? "#991b1b" : "#1e40af",
          border: `1px solid ${feedback.type === "success" ? "#a7f3d0" : feedback.type === "error" ? "#fecaca" : "#bfdbfe"}`
        }}>
          {feedback.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {feedback.text}
        </div>
      )}

      {/* Main MOM Form Section */}
      <div style={{
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14,
        padding: "24px 28px", boxShadow: "0 4px 16px rgba(0,0,0,0.03)", marginBottom: 30
      }}>
        
        {/* Document Type Dropdown */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingBottom: 20, marginBottom: 24, borderBottom: "1px solid #f1f5f9",
          flexWrap: "wrap", gap: 16
        }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
              Select Document Type
            </label>
            <select
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value)}
              style={{
                padding: "10px 14px", borderRadius: 8, border: "1px solid #cbd5e1",
                fontSize: 14, fontWeight: 700, color: "#1e293b", background: "#f8fafc",
                minWidth: 260, cursor: "pointer"
              }}
            >
              {docTypes.map(t => (
                <option key={t.id} value={t.id} disabled={!t.available}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            {activeMomId && (
              <button
                type="button"
                onClick={resetForm}
                style={{
                  padding: "9px 16px", borderRadius: 8, border: "1px solid #cbd5e1",
                  background: "#fff", color: "#475569", fontWeight: 600, fontSize: 13,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6
                }}
              >
                <Plus size={16} /> New Template
              </button>
            )}
          </div>
        </div>

        {/* Section 1: Meeting Information */}
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginTop: 0, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Layers size={18} color="#4f46e5" /> 1. Meeting Basic Details
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, marginBottom: 24 }}>
          <div style={{ gridColumn: "span 2" }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
              Meeting Title <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. WorkStockPro Project Sprint Sync"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1",
                fontSize: 14, color: "#0f172a", boxSizing: "border-box"
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
              Date &amp; Time
            </label>
            <input
              type="datetime-local"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1",
                fontSize: 14, color: "#0f172a", boxSizing: "border-box"
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
              Duration
            </label>
            <input
              type="text"
              placeholder="e.g. 1 Hour 30 Mins"
              value={meetingDuration}
              onChange={(e) => setMeetingDuration(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1",
                fontSize: 14, color: "#0f172a", boxSizing: "border-box"
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
              Organizer
            </label>
            <input
              type="text"
              placeholder="Organizer Name"
              value={organizer}
              onChange={(e) => setOrganizer(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1",
                fontSize: 14, color: "#0f172a", boxSizing: "border-box"
              }}
            />
          </div>
        </div>

        {/* Section 2: Attendees */}
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <User size={18} color="#4f46e5" /> 2. Meeting Attendees
        </h3>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Enter attendee name & role (e.g. Rahul Sharma - Tech Lead)"
              value={newAttendeeName}
              onChange={(e) => setNewAttendeeName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddAttendee(); } }}
              style={{
                flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1",
                fontSize: 14, color: "#0f172a"
              }}
            />
            <button
              type="button"
              onClick={handleAddAttendee}
              style={{
                padding: "9px 16px", borderRadius: 8, border: "none", background: "#4f46e5",
                color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13,
                display: "flex", alignItems: "center", gap: 6
              }}
            >
              <Plus size={16} /> Add Attendee
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {attendees.filter(a => typeof a === "string" ? a.trim() !== "" : true).map((att, idx) => (
              <span
                key={idx}
                style={{
                  background: "#eef2ff", color: "#3730a3", border: "1px solid #c7d2fe",
                  padding: "6px 12px", borderRadius: 20, fontSize: 13, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 8
                }}
              >
                {att}
                <button
                  type="button"
                  onClick={() => handleRemoveAttendee(idx)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#ef4444", padding: 0 }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Section 3: Agenda */}
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <Calendar size={18} color="#4f46e5" /> 3. Meeting Agenda
        </h3>
        <textarea
          rows={3}
          placeholder="Outline the main topics discussed or objectives of the meeting..."
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1",
            fontSize: 14, color: "#0f172a", marginBottom: 24, boxSizing: "border-box", fontFamily: "inherit"
          }}
        />

        {/* Section 4: Discussion Summary */}
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={18} color="#4f46e5" /> 4. Discussion Summary
        </h3>
        <textarea
          rows={4}
          placeholder="Key points, discussions, decisions made, and notes..."
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1",
            fontSize: 14, color: "#0f172a", marginBottom: 24, boxSizing: "border-box", fontFamily: "inherit"
          }}
        />

        {/* Section 5: Action Items */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <FileCheck size={18} color="#4f46e5" /> 5. Action Items &amp; Responsibilities
          </h3>
          <button
            type="button"
            onClick={handleAddActionItem}
            style={{
              padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1",
              background: "#f8fafc", color: "#4f46e5", fontWeight: 700, fontSize: 12,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4
            }}
          >
            <Plus size={14} /> Add Action Item
          </button>
        </div>

        <div style={{ marginBottom: 28 }}>
          {actionItems.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "grid", gridTemplateColumns: "2fr 1fr 1fr 40px", gap: 10,
                alignItems: "center", marginBottom: 10, background: "#f8fafc",
                padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0"
              }}
            >
              <input
                type="text"
                placeholder="Task description / decision..."
                value={item.task || ""}
                onChange={(e) => handleUpdateActionItem(idx, "task", e.target.value)}
                style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
              />
              <input
                type="text"
                placeholder="Assignee"
                value={item.assignee || ""}
                onChange={(e) => handleUpdateActionItem(idx, "assignee", e.target.value)}
                style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
              />
              <input
                type="text"
                placeholder="Target Date (e.g. 30 Sept)"
                value={item.dueDate || ""}
                onChange={(e) => handleUpdateActionItem(idx, "dueDate", e.target.value)}
                style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
              />
              <button
                type="button"
                onClick={() => handleRemoveActionItem(idx)}
                style={{
                  border: "none", background: "#fee2e2", color: "#dc2626", borderRadius: 6,
                  height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* Action Buttons: Save Draft & Generate PDF */}
        <div style={{ display: "flex", gap: 14, justifyContent: "flex-end", paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving || generatingPdf}
            style={{
              padding: "12px 22px", borderRadius: 10, border: "1px solid #cbd5e1",
              background: "#fff", color: "#334155", fontWeight: 700, fontSize: 14,
              cursor: saving ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 8
            }}
          >
            <Save size={18} color="#4f46e5" /> {saving ? "Saving Draft..." : "Save Draft"}
          </button>

          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={saving || generatingPdf}
            style={{
              padding: "12px 24px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)",
              color: "#fff", fontWeight: 700, fontSize: 14,
              cursor: generatingPdf ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)"
            }}
          >
            <Download size={18} /> {generatingPdf ? "Generating PDF..." : "Generate PDF"}
          </button>
        </div>
      </div>

      {/* Section 6: Employee Document History - My MOMs */}
      <div style={{
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14,
        padding: "24px 28px", boxShadow: "0 4px 16px rgba(0,0,0,0.03)"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>My Saved Templates</h3>
          <button
            onClick={fetchMoms}
            style={{
              background: "none", border: "none", cursor: "pointer", color: "#4f46e5",
              display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600
            }}
          >
            <RefreshCw size={14} /> Refresh List
          </button>
        </div>

        {loadingMoms ? (
          <div style={{ padding: 20, textAlign: "center", color: "#64748b" }}>Loading saved documents...</div>
        ) : moms.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#94a3b8", background: "#f8fafc", borderRadius: 10 }}>
            No saved templates found. Fill out the form above to create your first template!
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "12px 14px", color: "#475569", fontWeight: 700 }}>Meeting Title</th>
                  <th style={{ padding: "12px 14px", color: "#475569", fontWeight: 700 }}>Meeting Date</th>
                  <th style={{ padding: "12px 14px", color: "#475569", fontWeight: 700 }}>Status</th>
                  <th style={{ padding: "12px 14px", color: "#475569", fontWeight: 700 }}>Last Updated</th>
                  <th style={{ padding: "12px 14px", color: "#475569", fontWeight: 700, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {moms.map((mom) => (
                  <tr key={mom.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "14px", fontWeight: 600, color: "#1e293b" }}>{mom.meeting_title}</td>
                    <td style={{ padding: "14px", color: "#64748b" }}>
                      {mom.meeting_date ? new Date(mom.meeting_date).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td style={{ padding: "14px" }}>
                      <span style={{
                        padding: "4px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700,
                        background: mom.status === "Generated" ? "#dcfce7" : "#fef3c7",
                        color: mom.status === "Generated" ? "#166534" : "#92400e"
                      }}>
                        {mom.status || "Draft"}
                      </span>
                    </td>
                    <td style={{ padding: "14px", color: "#64748b", fontSize: 13 }}>
                      {mom.updated_at ? new Date(mom.updated_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "—"}
                    </td>
                    <td style={{ padding: "14px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => loadMomIntoForm(mom)}
                          style={{
                            padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1",
                            background: "#fff", color: "#334155", fontSize: 12, fontWeight: 600, cursor: "pointer"
                          }}
                        >
                          Edit
                        </button>

                        {mom.pdf_path ? (
                          <button
                            onClick={() => handleViewPdf(mom.id)}
                            style={{
                              padding: "6px 12px", borderRadius: 6, border: "none",
                              background: "#4f46e5", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
                              display: "flex", alignItems: "center", gap: 4
                            }}
                          >
                            <Download size={14} /> PDF
                          </button>
                        ) : (
                          <button
                            onClick={() => { loadMomIntoForm(mom); handleGeneratePdf(); }}
                            style={{
                              padding: "6px 12px", borderRadius: 6, border: "1px solid #c7d2fe",
                              background: "#eef2ff", color: "#4f46e5", fontSize: 12, fontWeight: 600, cursor: "pointer"
                            }}
                          >
                            Generate PDF
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteMom(mom.id, mom.meeting_title)}
                          style={{
                            padding: "6px 10px", borderRadius: 6, border: "1px solid #fecaca",
                            background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 600, cursor: "pointer"
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
