import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../utils/api";

// IST-safe date helpers
function getISTDateString(offsetDays = 0) {
  const now    = new Date();
  const ist    = new Date(now.getTime() + 5.5 * 60 * 60 * 1000 + offsetDays * 86400000);
  return ist.toISOString().split("T")[0];
}

const EMPTY_TASK = () => ({
  start: "", end: "", task_code: "", summary: "", equipment: "", personnel: "",
});

export default function DPR() {
  const locationState = useLocation();
  // BUG FIX: use IST date, not Date.now() which gives UTC
  const today    = getISTDateString(0);
  const tomorrow = getISTDateString(1);

  const [selectedDate, setSelectedDate] = useState(today);
  const [downloading,  setDownloading]  = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [error,        setError]        = useState("");

  const [project,     setProject]     = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [location,    setLocation]    = useState("Office");
  const [clockIn,     setClockIn]     = useState("");
  const [clockOut,    setClockOut]    = useState("");
  const [requirement, setRequirement] = useState("");
  const [remarks,     setRemarks]     = useState("");

  const initialTasks = locationState.state?.tasks?.map(t => ({
    start: "", 
    end: "", 
    task_code: t.task_code || "", 
    summary: t.title || t.summary || "", 
    equipment: "", 
    personnel: ""
  })) || Array.from({ length: 5 }, EMPTY_TASK);

  const [tasks, setTasks] = useState(initialTasks);

  // Load existing DPR when date changes
  useEffect(() => {
    const token = localStorage.getItem("token");
    api
      .get(`/dpr/my-dpr?date=${selectedDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => {
        if (data.entry) {
          const e = data.entry;
          setProject(e.project     || "");
          setProjectCode(e.project_code || "");
          setLocation(e.location   || "Office");
          setClockIn(e.clock_in    ? String(e.clock_in).slice(0, 5)  : "");
          setClockOut(e.clock_out  ? String(e.clock_out).slice(0, 5) : "");
          setRequirement(e.requirement || "");
          setRemarks(e.remarks     || "");
        } else {
          setProject(""); setProjectCode(""); setLocation("Office");
          setClockIn(""); setClockOut(""); setRequirement(""); setRemarks("");
        }
        if (data.tasks?.length) {
          const filled = data.tasks.map(t => ({
            start:      t.start_time  ? String(t.start_time).slice(0, 5)  : "",
            end:        t.end_time    ? String(t.end_time).slice(0, 5)    : "",
            task_code:  t.task_code   || "",
            summary:    t.summary     || "",
            equipment:  t.equipment   || "",
            personnel:  t.personnel   || "",
          }));
          // Pad to at least 5 rows
          while (filled.length < 5) filled.push(EMPTY_TASK());
          setTasks(filled);
        } else {
          setTasks(Array.from({ length: 5 }, EMPTY_TASK));
        }
        setSaved(false);
        setError("");
      })
      .catch(() => {});
  }, [selectedDate]);

  const updateTask = (index, field, value) => {
    setTasks(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addTaskRow = () => setTasks(prev => [...prev, EMPTY_TASK()]);

  const removeTaskRow = (index) =>
    setTasks(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);

  // ── SAVE DPR ────────────────────────────────────────────────────────────────
  const saveDPR = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const token = localStorage.getItem("token");
      await api.post(
        "/dpr/save",
        {
          dpr_date:    selectedDate,
          project,
          project_code: projectCode,
          location,
          clock_in:    clockIn  || null,
          clock_out:   clockOut || null,
          requirement: requirement || "N/A",
          remarks:     remarks     || "N/A",
          tasks:       tasks.filter(t => t.summary.trim() !== ""),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSaved(true);
    } catch (err) {
      if (err.response?.status === 403) {
        setError("❌ DPR can only be saved for today or tomorrow. Past dates are locked.");
      } else {
        setError(err.response?.data?.msg || "Failed to save DPR.");
      }
    } finally {
      setSaving(false);
    }
  };

  // ── DOWNLOAD DPR ────────────────────────────────────────────────────────────
  const downloadDPR = async () => {
    setDownloading(true);
    setError("");
    try {
      const token    = localStorage.getItem("token");
      const response = await api.get(
        `/dpr/download?date=${selectedDate}`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: "blob" }
      );
      const url  = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href  = url;
      link.setAttribute("download", `DPR_${selectedDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (err.response?.status === 403) {
        setError("❌ DPR can only be downloaded for today or tomorrow. Past dates are locked.");
      } else {
        setError("Error downloading DPR. Please save first, then download.");
      }
    } finally {
      setDownloading(false);
    }
  };

  // ── STYLES ──────────────────────────────────────────────────────────────────
  const s = {
    wrap:    { fontFamily: "Arial, sans-serif", maxWidth: 960, margin: "0 auto", padding: "20px" },
    card:    { background: "#fff", border: "1px solid #dde3ed", borderRadius: 10, padding: 24, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,.06)" },
    title:   { color: "#1F4E79", fontWeight: 700, fontSize: 20, marginBottom: 16 },
    grid2:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" },
    grid3:   { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px 20px" },
    label:   { display: "block", fontWeight: 600, fontSize: 12, color: "#444", marginBottom: 4 },
    input:   { width: "100%", padding: "7px 10px", border: "1px solid #c8d4e3", borderRadius: 6, fontSize: 13, boxSizing: "border-box" },
    textarea:{ width: "100%", padding: "7px 10px", border: "1px solid #c8d4e3", borderRadius: 6, fontSize: 13, boxSizing: "border-box", resize: "vertical", minHeight: 60 },
    thStyle: { background: "#1F4E79", color: "#fff", padding: "8px 10px", fontSize: 12, fontWeight: 600, textAlign: "center", whiteSpace: "nowrap" },
    tdStyle: { padding: "5px 6px", borderBottom: "1px solid #eee" },
    btnSave: { background: "linear-gradient(135deg,#1F4E79,#2e6da4)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
    btnDl:   { background: "linear-gradient(135deg,#0ea5e9,#0284c7)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
    btnAdd:  { background: "none", border: "1px dashed #1F4E79", color: "#1F4E79", borderRadius: 6, padding: "5px 14px", fontSize: 12, cursor: "pointer", marginTop: 8 },
    btnDel:  { background: "none", border: "none", color: "#cc0000", fontSize: 16, cursor: "pointer", padding: "0 6px" },
    success: { background: "#e6f9ee", border: "1px solid #4caf50", color: "#1b6b35", borderRadius: 7, padding: "10px 16px", marginBottom: 14, fontSize: 13 },
    errBox:  { background: "#fff0f0", border: "1px solid #f44336", color: "#b71c1c", borderRadius: 7, padding: "10px 16px", marginBottom: 14, fontSize: 13 },
  };

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ color: "#1F4E79", margin: 0 }}>📋 Daily Progress Report</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ fontWeight: 600, fontSize: 13 }}>Date:</label>
          <select
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ ...s.input, width: "auto" }}
          >
            <option value={today}>Today — {today}</option>
            <option value={tomorrow}>Tomorrow — {tomorrow}</option>
          </select>
        </div>
      </div>

      {saved && <div style={s.success}>✅ DPR saved successfully! You can now download the Excel sheet.</div>}
      {error && <div style={s.errBox}>{error}</div>}

      {/* Basic Info */}
      <div style={s.card}>
        <div style={s.title}>📌 Basic Information</div>
        <div style={s.grid3}>
          <div>
            <label style={s.label}>Project Name</label>
            <input style={s.input} value={project} onChange={e => setProject(e.target.value)} placeholder="e.g. UAV Survey Phase 2" />
          </div>
          <div>
            <label style={s.label}>Project Code</label>
            <input style={s.input} value={projectCode} onChange={e => setProjectCode(e.target.value)} placeholder="e.g. UAV-2025-07" />
          </div>
          <div>
            <label style={s.label}>Location</label>
            <input style={s.input} value={location} onChange={e => setLocation(e.target.value)} placeholder="Office / Field" />
          </div>
          <div>
            <label style={s.label}>Clock-In Time</label>
            <input style={s.input} type="time" value={clockIn} onChange={e => setClockIn(e.target.value)} />
          </div>
          <div>
            <label style={s.label}>Clock-Out Time</label>
            <input style={s.input} type="time" value={clockOut} onChange={e => setClockOut(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Task Rows */}
      <div style={s.card}>
        <div style={s.title}>📝 Task Details</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ ...s.thStyle, width: 70 }}>Start</th>
                <th style={{ ...s.thStyle, width: 70 }}>End</th>
                <th style={{ ...s.thStyle, width: 90 }}>Task Code</th>
                <th style={{ ...s.thStyle, minWidth: 200 }}>Summary of Work Done *</th>
                <th style={{ ...s.thStyle, minWidth: 130 }}>Equipment / Software</th>
                <th style={{ ...s.thStyle, minWidth: 120 }}>Personnel</th>
                <th style={{ ...s.thStyle, width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fafcff" : "#fff" }}>
                  <td style={s.tdStyle}>
                    <input type="time" style={s.input} value={task.start}
                      onChange={e => updateTask(i, "start", e.target.value)} />
                  </td>
                  <td style={s.tdStyle}>
                    <input type="time" style={s.input} value={task.end}
                      onChange={e => updateTask(i, "end", e.target.value)} />
                  </td>
                  <td style={s.tdStyle}>
                    <input style={s.input} value={task.task_code} placeholder="e.g. T-01"
                      onChange={e => updateTask(i, "task_code", e.target.value)} />
                  </td>
                  <td style={s.tdStyle}>
                    <input style={s.input} value={task.summary} placeholder="Describe work done..."
                      onChange={e => updateTask(i, "summary", e.target.value)} />
                  </td>
                  <td style={s.tdStyle}>
                    <input style={s.input} value={task.equipment} placeholder="e.g. AutoCAD"
                      onChange={e => updateTask(i, "equipment", e.target.value)} />
                  </td>
                  <td style={s.tdStyle}>
                    <input style={s.input} value={task.personnel} placeholder="e.g. Team A"
                      onChange={e => updateTask(i, "personnel", e.target.value)} />
                  </td>
                  <td style={s.tdStyle}>
                    <button style={s.btnDel} onClick={() => removeTaskRow(i)} title="Remove row">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button style={s.btnAdd} onClick={addTaskRow}>+ Add Row</button>
      </div>

      {/* Requirement & Remarks */}
      <div style={s.card}>
        <div style={s.grid2}>
          <div>
            <label style={s.label}>Requirement (If any)</label>
            <textarea style={s.textarea} value={requirement}
              onChange={e => setRequirement(e.target.value)}
              placeholder="Any requirements or blockers..." />
          </div>
          <div>
            <label style={s.label}>Remarks / Issues</label>
            <textarea style={s.textarea} value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Any remarks or issues faced..." />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={saveDPR} disabled={saving} style={{ ...s.btnSave, opacity: saving ? 0.7 : 1 }}>
          {saving ? "⏳ Saving..." : "💾 Save DPR"}
        </button>
        <button onClick={downloadDPR} disabled={downloading} style={{ ...s.btnDl, opacity: downloading ? 0.7 : 1 }}>
          {downloading ? "⏳ Generating..." : "📄 Download Excel"}
        </button>
        {!saved && (
          <span style={{ fontSize: 12, color: "#888", alignSelf: "center" }}>
            💡 Save first, then download to get your filled Excel sheet.
          </span>
        )}
      </div>
    </div>
  );
}
