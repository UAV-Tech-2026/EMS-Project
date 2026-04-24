import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import "../styles/TaskSpreadsheet.css";
import { Save, Plus, Trash2, ArrowLeft, Download } from "lucide-react";

const STATUS_MAP = {
  "Pending":     { label: "PENDING",      bg: "#fef9c3", color: "#854d0e", border: "#fde68a" },
  "In Progress": { label: "IN PROGRESS",  bg: "#dbeafe", color: "#1d4ed8", border: "#93c5fd" },
  "On Hold":     { label: "ON HOLD",      bg: "#fee2e2", color: "#b91c1c", border: "#fca5a5" },
  "Completed":   { label: "DONE",         bg: "#dcfce7", color: "#15803d", border: "#86efac" },
  "Review":      { label: "REVIEW",       bg: "#f3e8ff", color: "#7c3aed", border: "#d8b4fe" },
  "Yet to Start":{ label: "YET-TO-START", bg: "#e0f2fe", color: "#0369a1", border: "#7dd3fc" },
};

export default function TaskSpreadsheet() {
  const navigate   = useNavigate();
  const userObj    = JSON.parse(localStorage.getItem("user") || "{}");

  const [tasks,          setTasks]          = useState([]);
  const [employees,      setEmployees]      = useState([]);
  const [deletedTaskIds, setDeletedTaskIds] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [message,        setMessage]        = useState({ type: "", text: "" });
  const [activeDept,     setActiveDept]     = useState("All");

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setMessage({ type: "", text: "" });

      const taskRes = await api.get("/tasks/list");
      const fetchedTasks = taskRes.data;

      let allAssignable = [];
      try {
        const empRes = await api.get("/employees/all-assignable");
        allAssignable = empRes.data;
      } catch {
        try { const fb = await api.get("/attendance/employees-list"); allAssignable = fb.data; } catch {}
      }
      setEmployees(allAssignable);

      const mapped = fetchedTasks.map(t => ({
        id:                 t.id,
        task_code:          t.task_code || `#${t.id}`,
        title:              t.title || "",
        document_code:      t.document_code || "",
        output_format_type: t.output_format_type || "",
        costing:            t.costing || "",
        man_hours:          t.man_hours || "",
        assigned_to:        allAssignable.find(e => e.fullname === t.assigned_to_name)?.id || "",
        assigned_to_name:   t.assigned_to_name || "",
        department:         t.assigned_dept || allAssignable.find(e => e.fullname === t.assigned_to_name)?.department || "",
        reviewed_by:        t.reviewed_by_id
                              || allAssignable.find(e => e.fullname === t.reviewed_by_name)?.id
                              || allAssignable.find(e => e.fullname === t.reviewed_by)?.id
                              || "",
        start_date: t.start_date ? t.start_date.split("T")[0] : "",
        due_date:   t.due_date   ? t.due_date.split("T")[0]   : "",
        end_date:   t.end_date   ? t.end_date.split("T")[0]   : "",
        status:     t.status || "Pending",
        days_taken: t.days_taken || "",
        isNew: false,
      }));

      setTasks(mapped.length > 0 ? mapped : [emptyRow()]);
      setDeletedTaskIds([]);
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Failed to load data" });
    } finally { setLoading(false); }
  };

  const emptyRow = () => ({
    id:                 crypto.randomUUID(),
    task_code:          "NEW",
    title:              "",
    document_code:      "",
    output_format_type: "",
    costing:            "",
    man_hours:          "",
    assigned_to:        "",
    assigned_to_name:   "",
    department:         activeDept !== "All" ? activeDept : "",
    reviewed_by:        "",
    start_date:         "",
    due_date:           "",
    end_date:           "",
    status:             "Pending",
    days_taken:         "",
    isNew: true,
  });

  // ── Derived ──────────────────────────────────────────────────────────────────
  const departments = useMemo(() => {
    const s = new Set(tasks.map(t => t.department).filter(Boolean));
    return ["All", ...Array.from(s).sort()];
  }, [tasks]);

  const visibleTasks = useMemo(() =>
    activeDept === "All" ? tasks : tasks.filter(t => t.department === activeDept),
  [tasks, activeDept]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleAddRow = () =>
    setTasks(prev => [...prev, emptyRow()]);

  const handleChange = (id, field, value) =>
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const u = { ...t, [field]: value };
      if (field === "assigned_to") {
        const emp = employees.find(e => String(e.id) === String(value));
        u.assigned_to_name = emp?.fullname || "";
        u.department       = emp?.department || "";
      }
      return u;
    }));

  const handleDeleteRow = (id, isNew) => {
    if (!window.confirm("Remove this row?")) return;
    setTasks(prev => prev.filter(t => t.id !== id));
    if (!isNew) setDeletedTaskIds(prev => [...prev, id]);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage({ type: "", text: "" });
      const upserts = tasks
        .filter(t => t.title?.trim())
        .map(t => t.isNew ? api.post("/tasks/assign", t) : api.put(`/tasks/edit/${t.id}`, t));
      const deletes = deletedTaskIds.map(id => api.delete(`/tasks/delete/${id}`));
      await Promise.all([...upserts, ...deletes]);
      setMessage({ type: "success", text: "✓ Saved successfully!" });
      fetchInitialData();
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Error saving. Some changes may not have been recorded." });
    } finally { setSaving(false); }
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem("token");
      const res   = await fetch(`${import.meta.env.VITE_API_URL}/tasks/download-excel`,
        { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = "tasks.xlsx"; a.click();
      URL.revokeObjectURL(url);
    } catch { setMessage({ type: "error", text: "Export failed." }); }
  };

  const handleBack = () => {
    const role = userObj.role;
    if (role === "super_admin") navigate("/super-admin-dashboard");
    else navigate("/admin-dashboard");
  };

  if (loading) return <div className="spreadsheet-loading">Loading Spreadsheet...</div>;

  return (
    <div className="spreadsheet-page" style={{ display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden" }}>

      {/* ── Header ── */}
      <header className="spreadsheet-header" style={{ flexShrink:0 }}>
        <div className="header-left">
          <button onClick={handleBack} style={{ padding:"7px 14px", borderRadius:8, border:"1px solid #e2e8f0", background:"#fff", color:"#475569", display:"flex", alignItems:"center", gap:6, fontWeight:600, fontSize:13, cursor:"pointer", marginRight:16 }}>
            <ArrowLeft size={15}/> Back
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:38, height:38, background:"#fff", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid #e2e8f0", overflow:"hidden" }}>
              <img src={import.meta.env.VITE_LOGO_URL || "/logo.jpg"} alt="Logo"
                style={{ width:34, height:34, objectFit:"contain" }}
                onError={e => { if (e.target.src !== window.location.origin+"/logo.jpg") e.target.src="/logo.jpg"; else e.target.style.display="none"; }} />
            </div>
            <h1 style={{ fontSize:16, fontWeight:800, color:"#1e293b" }}>Task Master Sheet</h1>
          </div>
        </div>

        <div className="header-actions">
          {message.text && (
            <span style={{ fontSize:12, fontWeight:600, padding:"6px 12px", borderRadius:6,
              background: message.type==="success"?"#dcfce7":"#fee2e2",
              color: message.type==="success"?"#166534":"#991b1b" }}>
              {message.text}
            </span>
          )}
          <button className="action-btn export" onClick={handleExport}><Download size={15}/> Export</button>
          <button className="action-btn add"    onClick={handleAddRow}><Plus size={15}/> Add Row</button>
          <button className="action-btn save"   onClick={handleSave} disabled={saving}>
            <Save size={15}/> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      {/* ── Spreadsheet area ── */}
      <div style={{ flex:1, overflow:"auto", display:"flex", flexDirection:"column" }}>
        <table className="excel-table" style={{ borderCollapse:"collapse", width:"max-content", minWidth:"100%", fontSize:12, tableLayout:"fixed" }}>
          <colgroup>
            <col style={{ width:36 }}/>   {/* delete */}
            <col style={{ width:40 }}/>   {/* # */}
            <col style={{ width:220 }}/>  {/* TASK */}
            <col style={{ width:120 }}/>  {/* Doc Code */}
            <col style={{ width:180 }}/>  {/* Output Format */}
            <col style={{ width:150 }}/>  {/* Assigned to */}
            <col style={{ width:150 }}/>  {/* Reviewed by */}
            <col style={{ width:90 }}/>   {/* Costing */}
            <col style={{ width:90 }}/>   {/* Man hours */}
            <col style={{ width:120 }}/>  {/* Start Date */}
            <col style={{ width:130 }}/>  {/* Est. Closure */}
            <col style={{ width:120 }}/>  {/* End Date */}
            <col style={{ width:130 }}/>  {/* STATUS */}
            <col style={{ width:90 }}/>   {/* Days taken */}
          </colgroup>
          <thead>
            <tr style={{ background:"#1e293b", color:"#fff", position:"sticky", top:0, zIndex:10 }}>
              <th style={TH}></th>
              <th style={TH}>#</th>
              <th style={TH}>TASK</th>
              <th style={TH}>Document Code</th>
              <th style={TH}>Output Format Type</th>
              <th style={TH}>Assigned to</th>
              <th style={TH}>Reviewed by</th>
              <th style={TH}>Costing (₹)</th>
              <th style={TH}>Man hours</th>
              <th style={TH}>Start Date</th>
              <th style={TH}>Est. Closure Date</th>
              <th style={TH}>End Date</th>
              <th style={TH}>STATUS</th>
              <th style={TH}>No of days taken</th>
            </tr>
          </thead>
          <tbody>
            {visibleTasks.map((task, idx) => {
              const sStyle = STATUS_MAP[task.status] || STATUS_MAP["Pending"];
              return (
                <tr key={task.id} style={{ background: idx%2===0?"#fff":"#f8fafc" }}>
                  <td style={TD}>
                    <button onClick={() => handleDeleteRow(task.id, task.isNew)}
                      style={{ background:"none", border:"none", cursor:"pointer", color:"#ef4444", display:"flex", padding:"2px 4px" }}>
                      <Trash2 size={13}/>
                    </button>
                  </td>
                  <td style={{ ...TD, textAlign:"center", color:"#94a3b8", fontSize:11 }}>{idx+1}</td>
                  <td style={TD}>
                    <input style={INPUT} value={task.title}
                      onChange={e => handleChange(task.id,"title",e.target.value)}
                      placeholder="Enter task…"/>
                  </td>
                  <td style={TD}>
                    <input style={{...INPUT, color:"#4f46e5", fontWeight:600}}
                      value={task.document_code}
                      onChange={e => handleChange(task.id,"document_code",e.target.value)}
                      placeholder="e.g. DD-FP-AA"/>
                  </td>
                  <td style={TD}>
                    <input style={INPUT} value={task.output_format_type}
                      onChange={e => handleChange(task.id,"output_format_type",e.target.value)}
                      placeholder="e.g. Floor Plan Diagram"/>
                  </td>
                  <td style={TD}>
                    <select style={INPUT} value={task.assigned_to}
                      onChange={e => handleChange(task.id,"assigned_to",e.target.value)}>
                      <option value="">— Select —</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.fullname}</option>
                      ))}
                    </select>
                  </td>
                  <td style={TD}>
                    <select style={INPUT} value={task.reviewed_by}
                      onChange={e => handleChange(task.id,"reviewed_by",e.target.value)}>
                      <option value="">— Select —</option>
                      {employees.filter(e => (e.role||"").includes("admin")).map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.fullname}</option>
                      ))}
                    </select>
                  </td>
                  <td style={TD}>
                    <input style={{...INPUT, textAlign:"right"}} type="number" value={task.costing}
                      onChange={e => handleChange(task.id,"costing",e.target.value)}/>
                  </td>
                  <td style={TD}>
                    <input style={{...INPUT, textAlign:"right"}} type="number" value={task.man_hours}
                      onChange={e => handleChange(task.id,"man_hours",e.target.value)}/>
                  </td>
                  <td style={TD}>
                    <input style={INPUT} type="date" value={task.start_date}
                      onChange={e => handleChange(task.id,"start_date",e.target.value)}/>
                  </td>
                  <td style={TD}>
                    <input style={INPUT} type="date" value={task.due_date}
                      onChange={e => handleChange(task.id,"due_date",e.target.value)}/>
                  </td>
                  <td style={TD}>
                    <input style={INPUT} type="date" value={task.end_date}
                      onChange={e => handleChange(task.id,"end_date",e.target.value)}/>
                  </td>
                  <td style={{ ...TD, padding:"4px 6px" }}>
                    <select value={task.status}
                      onChange={e => handleChange(task.id,"status",e.target.value)}
                      style={{ width:"100%", padding:"5px 6px", borderRadius:6, fontWeight:700,
                        fontSize:10, border:`1px solid ${sStyle.border}`,
                        background:sStyle.bg, color:sStyle.color, cursor:"pointer",
                        textTransform:"uppercase", letterSpacing:"0.04em" }}>
                      {Object.entries(STATUS_MAP).map(([val]) => (
                        <option key={val} value={val}>{val}</option>
                      ))}
                    </select>
                  </td>
                  <td style={TD}>
                    <input style={{...INPUT, textAlign:"center"}} type="number" value={task.days_taken}
                      onChange={e => handleChange(task.id,"days_taken",e.target.value)}/>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {visibleTasks.length === 0 && (
          <div style={{ padding:"40px 20px", textAlign:"center", color:"#94a3b8", fontSize:13 }}>
            No tasks for <strong>{activeDept}</strong>. Click <strong>Add Row</strong> to create one.
          </div>
        )}
      </div>

      {/* ── Google-Sheets-style Bottom Department Tabs ── */}
      <div style={{
        display:"flex", alignItems:"center", gap:0,
        background:"#f1f5f9", borderTop:"2px solid #e2e8f0",
        overflowX:"auto", flexShrink:0, minHeight:36,
        padding:"0 8px"
      }}>
        <button onClick={handleAddRow}
          style={{ padding:"0 10px", height:36, background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:16, flexShrink:0 }}
          title="Add Row">+</button>
        {departments.map(dept => (
          <button key={dept} onClick={() => setActiveDept(dept)}
            style={{
              height:36, padding:"0 18px", cursor:"pointer", flexShrink:0,
              background: activeDept===dept ? "#fff" : "transparent",
              color:      activeDept===dept ? "#4f46e5" : "#64748b",
              fontWeight: activeDept===dept ? 700 : 500,
              fontSize:12,
              border:"none",
              borderTop:  activeDept===dept ? "2px solid #4f46e5" : "2px solid transparent",
              borderRight:"1px solid #e2e8f0",
              borderLeft: "1px solid transparent",
              marginTop: activeDept===dept ? "-2px" : 0,
              transition:"all 0.15s",
              whiteSpace:"nowrap",
              fontFamily:"DM Sans, sans-serif",
            }}>
            {dept}
            {dept !== "All" && (
              <span style={{ marginLeft:5, fontSize:10, background:"#e0e7ff", color:"#4338ca", borderRadius:10, padding:"0 5px", fontWeight:700 }}>
                {tasks.filter(t => t.department===dept).length}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Shared cell styles ────────────────────────────────────────────────────────
const TH = {
  padding:"10px 8px", textAlign:"left", fontSize:11,
  fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase",
  borderRight:"1px solid rgba(255,255,255,0.1)", whiteSpace:"nowrap"
};
const TD = {
  padding:"3px 4px", borderBottom:"1px solid #e2e8f0",
  borderRight:"1px solid #f1f5f9", verticalAlign:"middle"
};
const INPUT = {
  width:"100%", padding:"5px 6px", border:"1px solid transparent",
  borderRadius:4, fontSize:12, background:"transparent",
  boxSizing:"border-box", outline:"none", fontFamily:"inherit",
  transition:"border-color 0.15s",
};
