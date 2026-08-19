import { useState, useEffect } from "react";
import { api } from "../utils/api";
import { Eye, X, ChevronDown, ChevronUp, Layers, Calendar, Download } from "lucide-react";

function getISTDate(offsetDays = 0) {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000 + offsetDays * 86400000);
  return ist.toISOString().split("T")[0];
}

const EMPTY_TASK = () => ({ start: "", end: "", task_code: "", summary: "", equipment: "", personnel: "" });

const inp = {
  width: "100%", padding: "7px 10px",
  border: "1px solid #e2e8f0", borderRadius: 7,
  fontSize: 13, boxSizing: "border-box",
  background: "#fff", outline: "none",
  fontFamily: "inherit",
};

const lbl = {
  display: "block", fontSize: 11, fontWeight: 700,
  color: "#64748b", textTransform: "uppercase",
  letterSpacing: "0.04em", marginBottom: 4,
};


function HistoryModal({ onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    api.get("/dpr/my-history")
      .then(r => setHistory(Array.isArray(r.data) ? r.data : []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  const loadDetails = async (date) => {
    setSelected(date);
    setDetailLoading(true);
    try {
      const r = await api.get(`/dpr/my-dpr?date=${date}`);
      setDetails(r.data);
    } catch { setDetails(null); }
    finally { setDetailLoading(false); }
  };

  const fmt = (t) => t ? String(t).slice(0, 5) : "—";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)",
      zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(4px)", padding: 20,
    }}>
      <div style={{
        background: "#fff", width: "100%", maxWidth: 820,
        borderRadius: 18, overflow: "hidden",
        boxShadow: "0 24px 60px rgba(0,0,0,0.15)",
        display: "flex", flexDirection: "column", maxHeight: "90vh",
      }}>
        {/* Modal header */}
        <div style={{
          background: "linear-gradient(135deg,#1e3a8a,#4f46e5)",
          padding: "18px 24px", display: "flex",
          alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Calendar size={20} color="#fff" />
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>
              {selected ? `DPR — ${new Date(selected).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })}` : "My DPR History"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {selected && (
              <button onClick={() => { setSelected(null); setDetails(null); }}
                style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                ← Back to List
              </button>
            )}
            <button onClick={onClose}
              style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
          {/* List view */}
          {!selected && (
            loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading history…</div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                No DPRs saved yet.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                    {["Date", "Project", "Clock In", "Clock Out", ""].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((row, i) => (
                    <tr key={row.dpr_date} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: "#1e293b" }}>
                        {new Date(row.dpr_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#475569" }}>{row.project || "—"}</td>
                      <td style={{ padding: "12px 14px", color: "#475569" }}>{fmt(row.clock_in)}</td>
                      <td style={{ padding: "12px 14px", color: "#475569" }}>{fmt(row.clock_out)}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <button onClick={() => loadDetails(row.dpr_date)}
                          style={{ display: "flex", alignItems: "center", gap: 5, background: "#eff6ff", color: "#3b82f6", border: "none", padding: "6px 12px", borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                          <Eye size={13} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

        
          {selected && (
            detailLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>Loading…</div>
            ) : !details?.entry ? (
              <div style={{ textAlign: "center", padding: 40, color: "#ef4444" }}>Could not load DPR details.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, background: "#f8fafc", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                  {[
                    ["Project", details.entry.project],
                    ["Location", details.entry.location],
                    ["Hours", `${fmt(details.entry.clock_in)} – ${fmt(details.entry.clock_out)}`],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>{k}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{v || "—"}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <Layers size={14} /> Task Breakdown
                  </div>
                  {details.tasks?.length ? (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#1e3a8a" }}>
                          {["Time", "Code", "Summary", "Equipment", "Personnel"].map(h => (
                            <th key={h} style={{ padding: "8px 10px", color: "#fff", fontWeight: 700, textAlign: "left" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {details.tasks.map((t, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ padding: "8px 10px", whiteSpace: "nowrap", color: "#64748b" }}>{fmt(t.start_time)}–{fmt(t.end_time)}</td>
                            <td style={{ padding: "8px 10px", fontWeight: 600 }}>{t.task_code || "—"}</td>
                            <td style={{ padding: "8px 10px" }}>{t.summary}</td>
                            <td style={{ padding: "8px 10px", color: "#64748b" }}>{t.equipment || "—"}</td>
                            <td style={{ padding: "8px 10px", color: "#64748b" }}>{t.personnel || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ padding: 16, border: "1px dashed #cbd5e1", borderRadius: 8, color: "#94a3b8", textAlign: "center" }}>No tasks recorded.</div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[["Requirements / Blockers", details.entry.requirement], ["Remarks / Issues", details.entry.remarks]].map(([k, v]) => (
                    <div key={k} style={{ background: "#fff", border: "1px solid #e2e8f0", padding: 14, borderRadius: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6, textTransform: "uppercase" }}>{k}</div>
                      <div style={{ fontSize: 13, color: "#334155" }}>{v || "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function DPRCard() {
  const today = getISTDate(0);
  const yesterday = getISTDate(-1);

  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const [project, setProject] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [location, setLocation] = useState("Office");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [requirement, setRequirement] = useState("");
  const [remarks, setRemarks] = useState("");
  const [tasks, setTasks] = useState(Array.from({ length: 3 }, EMPTY_TASK));
  const [assignedAdminId, setAssignedAdminId] = useState("");
  const [admins, setAdmins] = useState([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [taskCodeOptions, setTaskCodeOptions] = useState([]);
  const [customCodeMode, setCustomCodeMode] = useState({});
  const [codeDropdownOpenFor, setCodeDropdownOpenFor] = useState(null);

  // Close the custom code dropdown when clicking anywhere outside it
  useEffect(() => {
    if (codeDropdownOpenFor === null) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest(`[data-tc-dropdown="${codeDropdownOpenFor}"]`)) {
        setCodeDropdownOpenFor(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [codeDropdownOpenFor]);

  // Load known task codes once, up front (not gated on `expanded` — cheap, and we
  // want the list ready the moment the form opens)
  useEffect(() => {
    api.get("/dpr/task-codes")
      .then(r => setTaskCodeOptions(Array.isArray(r.data) ? r.data : []))
      .catch(() => setTaskCodeOptions([]));
  }, []);

  // Load existing DPR when date changes
  useEffect(() => {
    if (!expanded) return;
    setSaved(false); setError("");
    // Fetch admins list when form is first opened
    if (admins.length === 0) {
      setAdminsLoading(true);
      api.get("/dpr/admins")
        .then(r => setAdmins(Array.isArray(r.data) ? r.data : []))
        .catch(() => setAdmins([]))
        .finally(() => setAdminsLoading(false));
    }
    api.get(`/dpr/my-dpr?date=${selectedDate}`)
      .then(({ data }) => {
        if (data.entry) {
          const e = data.entry;
          setProject(e.project || ""); setProjectCode(e.project_code || "");
          setLocation(e.location || "Office");
          setClockIn(e.clock_in ? String(e.clock_in).slice(0, 5) : "");
          setClockOut(e.clock_out ? String(e.clock_out).slice(0, 5) : "");
          setRequirement(e.requirement || ""); setRemarks(e.remarks || "");
          setAssignedAdminId(e.assigned_admin_id ? String(e.assigned_admin_id) : "");
        } else {
          setProject(""); setProjectCode(""); setLocation("Office");
          setClockIn(""); setClockOut(""); setRequirement(""); setRemarks("");
          setAssignedAdminId("");
        }
        if (data.tasks?.length) {
          const filled = data.tasks.map(t => ({
            start: t.start_time ? String(t.start_time).slice(0, 5) : "",
            end: t.end_time ? String(t.end_time).slice(0, 5) : "",
            task_code: t.task_code || "", summary: t.summary || "",
            equipment: t.equipment || "", personnel: t.personnel || "",
          }));
          while (filled.length < 3) filled.push(EMPTY_TASK());
          setTasks(filled);
        } else {
          setTasks(Array.from({ length: 3 }, EMPTY_TASK));
        }
      })
      .catch(() => {});
  }, [selectedDate, expanded]);

  const updateTask = (i, f, v) => {
    setTasks(prev => { const n = [...prev]; n[i] = { ...n[i], [f]: v }; return n; });
  };

  const handleRemoveCode = async (code) => {
    try {
      const res = await api.delete(`/dpr/task-codes/${encodeURIComponent(code)}`);
      if (res.data?.stillInHistory) {
        setError(` "${code}" was used in a saved DPR before, so it'll still appear next time you reload — it's just removed from the quick list for now.`);
      } else {
        setTaskCodeOptions(prev => prev.filter(c => c !== code));
      }
    } catch {
      setError(`Failed to remove "${code}".`);
    }
  };

  const handleSave = async () => {
    setSaving(true); setSaved(false); setError("");
    try {
      await api.post("/dpr/save", {
        dpr_date: selectedDate, project, project_code: projectCode,
        location, clock_in: clockIn || null, clock_out: clockOut || null,
        requirement: requirement || "N/A", remarks: remarks || "N/A",
        tasks: tasks.filter(t => t.summary.trim()),
        assigned_admin_id: assignedAdminId ? parseInt(assignedAdminId, 10) : null,
      });
      setSaved(true);
      // Any newly-typed codes should be selectable immediately, without a refetch
      const newCodes = tasks.map(t => t.task_code).filter(c => c && !taskCodeOptions.includes(c));
      if (newCodes.length > 0) {
        setTaskCodeOptions(prev => [...prev, ...newCodes].sort());
      }
    } catch (err) {
      setError(err.response?.status === 403
        ? " DPR can only be saved for today or yesterday."
        : err.response?.data?.msg || "Failed to save DPR.");
    } finally { setSaving(false); }
  };

  const handleDownloadExcel = async () => {
    setDownloading(true); setError("");
    try {
      const res = await api.get(`/dpr/download?date=${selectedDate}`, { responseType: "blob" });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", `DPR_${selectedDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err.response?.status === 403
        ? " DPR can only be exported for today or yesterday."
        : "Failed to export DPR. Try saving it first.");
    } finally { setDownloading(false); }
  };

  return (
    <>
      <div style={{
        background: "#fff", borderRadius: 16,
        border: "1px solid #e2e8f0",
        boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
        overflow: "hidden", marginBottom: 20,
      }}>
       
        <div style={{
          background: "linear-gradient(135deg,#1e3a8a 0%,#4f46e5 100%)",
          padding: "16px 20px", display: "flex",
          alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 20 }}>📋</div>
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>Daily Progress Report</div>
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>Fill & save without downloading</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setShowHistory(true)}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              <Eye size={14} /> History
            </button>
            <button
              onClick={() => setExpanded(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              {expanded ? <><ChevronUp size={14} /> Collapse</> : <><ChevronDown size={14} /> Fill DPR</>}
            </button>
          </div>
        </div>

       
        {expanded && (
          <div style={{ padding: "20px 24px" }}>
            {/* Date selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <label style={lbl}>Date</label>
              <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                style={{ ...inp, width: "auto", fontWeight: 700 }}>
                <option value={today}>Today — {today}</option>
                <option value={yesterday}>Yesterday — {yesterday}</option>
              </select>
            </div>

            {saved && (
              <div style={{ background: "#e6f9ee", border: "1px solid #4caf50", color: "#1b6b35", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
                 DPR saved successfully!
              </div>
            )}
            {error && (
              <div style={{ background: "#fff0f0", border: "1px solid #f44336", color: "#b71c1c", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
                {error}
              </div>
            )}

            {/* Basic Info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px 16px", marginBottom: 18 }}>
              <div><label style={lbl}>Project Name</label><input style={inp} value={project} onChange={e => setProject(e.target.value)} placeholder="e.g. UAV Survey Phase 2" /></div>
              <div><label style={lbl}>Project Code</label><input style={inp} value={projectCode} onChange={e => setProjectCode(e.target.value)} placeholder="e.g. UAV-2025-07" /></div>
              <div><label style={lbl}>Location</label><input style={inp} value={location} onChange={e => setLocation(e.target.value)} placeholder="Office / Field" /></div>
              <div><label style={lbl}>Clock-In</label><input style={inp} type="time" value={clockIn} onChange={e => setClockIn(e.target.value)} /></div>
              <div><label style={lbl}>Clock-Out</label><input style={inp} type="time" value={clockOut} onChange={e => setClockOut(e.target.value)} /></div>
            </div>

            {/* Tasks Table */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                Task Details
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {["Start", "End", "Task Code", "Summary of Work Done *", "Equipment", "Personnel", ""].map(h => (
                        <th key={h} style={{ background: "#1e3a8a", color: "#fff", padding: "8px 10px", fontWeight: 700, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                        <td style={{ padding: "4px 6px" }}><input type="time" style={inp} value={t.start} onChange={e => updateTask(i, "start", e.target.value)} /></td>
                        <td style={{ padding: "4px 6px" }}><input type="time" style={inp} value={t.end} onChange={e => updateTask(i, "end", e.target.value)} /></td>
                        <td style={{ padding: "4px 6px" }}>
                          {customCodeMode[i] || (t.task_code && !taskCodeOptions.includes(t.task_code)) ? (
                            <div style={{ display: "flex", gap: 4 }}>
                              <input
                                style={inp}
                                value={t.task_code}
                                placeholder="Enter new code"
                                onChange={e => updateTask(i, "task_code", e.target.value)}
                                onBlur={e => {
                                  const code = e.target.value.trim();
                                  if (code && !taskCodeOptions.includes(code)) {
                                    api.post("/dpr/task-codes/register", { code }).catch(() => {});
                                    setTaskCodeOptions(prev => [...prev, code].sort());
                                  }
                                }}
                              />
                              {taskCodeOptions.length > 0 && (
                                <button
                                  type="button"
                                  title="Choose from list instead"
                                  onClick={() => { setCustomCodeMode(m => ({ ...m, [i]: false })); updateTask(i, "task_code", ""); }}
                                  style={{ border: "1px solid #e2e8f0", borderRadius: 7, background: "#fff", cursor: "pointer", padding: "0 8px", fontSize: 12, color: "#64748b" }}
                                >
                                  ↺
                                </button>
                              )}
                            </div>
                          ) : (
                            <div style={{ position: "relative" }} data-tc-dropdown={i}>
                              <button
                                type="button"
                                onClick={() => setCodeDropdownOpenFor(codeDropdownOpenFor === i ? null : i)}
                                style={{ ...inp, textAlign: "left", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}
                              >
                                <span style={{ color: t.task_code ? "#0f172a" : "#94a3b8" }}>{t.task_code || "Select code"}</span>
                                <span style={{ fontSize: 10, color: "#94a3b8" }}>▾</span>
                              </button>

                              {codeDropdownOpenFor === i && (
                                <div style={{
                                  position: "absolute", top: "calc(100% + 4px)", left: 0, minWidth: 180, zIndex: 50,
                                  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8,
                                  boxShadow: "0 10px 28px rgba(0,0,0,0.14)", maxHeight: 220, overflowY: "auto",
                                }}>
                                  <div
                                    onClick={() => { updateTask(i, "task_code", ""); setCodeDropdownOpenFor(null); }}
                                    style={{ padding: "8px 10px", fontSize: 12, cursor: "pointer", color: "#64748b" }}
                                  >
                                    Select code
                                  </div>
                                  {taskCodeOptions.map(code => (
                                    <div key={code} style={{
                                      display: "flex", alignItems: "center", justifyContent: "space-between",
                                      padding: "6px 6px 6px 10px", fontSize: 12,
                                      background: t.task_code === code ? "#eff6ff" : "#fff",
                                    }}>
                                      <span
                                        onClick={() => { updateTask(i, "task_code", code); setCodeDropdownOpenFor(null); }}
                                        style={{ cursor: "pointer", flex: 1, fontWeight: t.task_code === code ? 700 : 500, color: t.task_code === code ? "#1d4ed8" : "#334155" }}
                                      >
                                        {code}
                                      </span>
                                      <button
                                        type="button"
                                        title="Remove this code"
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={e => { e.stopPropagation(); handleRemoveCode(code); }}
                                        style={{ border: "none", background: "#f1f5f9", color: "#64748b", borderRadius: "50%", width: 16, height: 16, fontSize: 11, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, marginLeft: 6, flexShrink: 0 }}
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                  <div
                                    onClick={() => { setCustomCodeMode(m => ({ ...m, [i]: true })); updateTask(i, "task_code", ""); setCodeDropdownOpenFor(null); }}
                                    style={{ padding: "8px 10px", fontSize: 12, cursor: "pointer", color: "#3b82f6", fontWeight: 700, borderTop: "1px solid #f1f5f9" }}
                                  >
                                    + Other (type new)
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "4px 6px", minWidth: 200 }}>
                          <textarea style={{ ...inp, minHeight: 56, resize: "vertical", lineHeight: 1.5 }} value={t.summary} placeholder="Describe work done..." onChange={e => updateTask(i, "summary", e.target.value)} />
                        </td>
                        <td style={{ padding: "4px 6px" }}><input style={inp} value={t.equipment} placeholder="e.g. AutoCAD" onChange={e => updateTask(i, "equipment", e.target.value)} /></td>
                        <td style={{ padding: "4px 6px" }}><input style={inp} value={t.personnel} placeholder="e.g. Team A" onChange={e => updateTask(i, "personnel", e.target.value)} /></td>
                        <td style={{ padding: "4px 6px" }}>
                          <button onClick={() => setTasks(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)}
                            style={{ background: "none", border: "none", color: "#ef4444", fontSize: 16, cursor: "pointer", padding: "0 4px" }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={() => setTasks(prev => [...prev, EMPTY_TASK()])}
                style={{ marginTop: 8, background: "none", border: "1px dashed #4f46e5", color: "#4f46e5", borderRadius: 6, padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                + Add Row
              </button>
            </div>

            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <div>
                <label style={lbl}>Requirement (if any)</label>
                <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={requirement} onChange={e => setRequirement(e.target.value)} placeholder="Any requirements or blockers..." />
              </div>
              <div>
                <label style={lbl}>Remarks / Issues</label>
                <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any remarks or issues faced..." />
              </div>
            </div>

            {/* Submit to Admin */}
            <div style={{ marginBottom: 20, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px" }}>
              <label style={{ ...lbl, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span></span> Submit DPR To Admin
                <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 400, textTransform: "none", marginLeft: 4 }}>(optional — admin will be notified)</span>
              </label>
              {adminsLoading ? (
                <div style={{ fontSize: 13, color: "#94a3b8", padding: "8px 0" }}>Loading admins…</div>
              ) : (
                <select
                  value={assignedAdminId}
                  onChange={e => setAssignedAdminId(e.target.value)}
                  style={{ ...inp, maxWidth: 360, fontWeight: assignedAdminId ? 600 : 400 }}
                >
                  <option value="">— Select an admin (optional) —</option>
                  {admins.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.fullname}{a.department ? ` · ${a.department}` : ""}{a.role === "super_admin" ? " (Super Admin)" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

           
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={handleSave} disabled={saving}
                style={{ background: "linear-gradient(135deg,#1e3a8a,#4f46e5)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 28px", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : " Save DPR"}
              </button>
              <button onClick={handleDownloadExcel} disabled={downloading}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", color: "#1e3a8a", border: "1.5px solid #1e3a8a", borderRadius: 9, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: downloading ? "not-allowed" : "pointer", opacity: downloading ? 0.7 : 1 }}>
                <Download size={15} /> {downloading ? "Exporting…" : "Export Excel"}
              </button>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>Saved records are viewable in History</span>
            </div>
          </div>
        )}
      </div>

      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
    </>
  );
}
