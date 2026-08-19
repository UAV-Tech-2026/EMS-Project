import React, { useState, useEffect, useRef } from "react";
import { api } from "../utils/api";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import "../styles/TaskManagement.css";

import RecurringTasks from "../components/RecurringTasks";
import RecurringTaskFields from "../components/RecurringTaskFields";
import TaskCommentBox from "../components/TaskCommentBox";

const STATUS_COLORS = {
  "Pending":     { bg: "#fef9c3", color: "#854d0e" },
  "In Progress": { bg: "#dbeafe", color: "#1d4ed8" },
  "On Hold":     { bg: "#fee2e2", color: "#b91c1c" },
  "Completed":   { bg: "#dcfce7", color: "#15803d" },
  "Review":      { bg: "#f3e8ff", color: "#7c3aed" },
};

const today   = new Date().toISOString().split("T")[0];
const minDate = new Date(new Date().setFullYear(new Date().getFullYear() - 2)).toISOString().split("T")[0];
const maxDate = new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split("T")[0];


function TaskStatsPanel({ stats, onFilter }) {
  if (!stats) return null;
  const cards = [
    { key: "yet_to_start", label: "Yet to Start",  value: parseInt(stats.yet_to_start) || 0, color: "#854d0e",  bg: "#fef9c3", border: "#fde68a" },
    { key: "delayed",      label: "Delayed",        value: parseInt(stats.delayed)      || 0, color: "#b91c1c",  bg: "#fee2e2", border: "#fca5a5"},
    { key: "due_today",    label: "Due Today",      value: parseInt(stats.due_today)    || 0, color: "#1d4ed8",  bg: "#dbeafe", border: "#93c5fd"},
    { key: "in_progress",  label: "In Progress",    value: parseInt(stats.in_progress)  || 0, color: "#15803d",  bg: "#dcfce7", border: "#86efac"},
    // NOTE: intentionally reads stats.completed (actual-doer count), not
    // stats.creditedCompleted (root-owner rollup) — per team lead direction,
    // credit tracks whoever physically did the work, not who assigned it.
    { key: "completed",    label: "Completed",      value: parseInt(stats.completed)    || 0, color: "#4338ca",  bg: "#e0e7ff", border: "#c7d2fe"},
  ];
  return (
    <div className="tm-stats-panel">
      {cards.map(card => (
        <div
          key={card.key}
          className="tm-stat-card"
          style={{ background: card.bg, borderColor: card.border }}
          onClick={() => onFilter(card.key)}
          title={`Filter: ${card.label}`}
        >
          <div className="tm-stat-icon">{card.icon}</div>
          <div className="tm-stat-num" style={{ color: card.color }}>{card.value}</div>
          <div className="tm-stat-lbl" style={{ color: card.color }}>{card.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function TaskManagement({ onClose, readOnly: propReadOnly }) {
  const navigate     = useNavigate();
  const [tasks,      setTasks]      = useState([]);
  const [employees,  setEmployees]  = useState([]);
  const [taskChains, setTaskChains] = useState({}); // taskId -> chain array, cached once fetched

  // Fetches and caches a task's delegation chain, then renders it as a
  // breadcrumb. Only worth calling for tasks that have a parent (i.e. were
  // actually delegated) — root tasks with no chain don't need this.
  const TaskChainBreadcrumb = ({ taskId }) => {
    const chain = taskChains[taskId];

    useEffect(() => {
      if (chain) return; // already fetched
      let cancelled = false;
      api.get(`/tasks/${taskId}/chain`)
        .then(res => { if (!cancelled) setTaskChains(prev => ({ ...prev, [taskId]: res.data })); })
        .catch(() => { if (!cancelled) setTaskChains(prev => ({ ...prev, [taskId]: [] })); });
      return () => { cancelled = true; };
    }, [taskId, chain]);

    if (!chain || chain.length === 0) return null;

    return (
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
        {chain.map((step, i) => (
          <span key={step.id}>
            {i === 0 && <span>Created by <strong>{step.assigned_by_name || "—"}</strong></span>}
            <span style={{ margin: "0 4px" }}>→</span>
            <span>
              {i === chain.length - 1 ? "Completed by" : "Delegated by"} <strong>{step.assigned_to_name || "—"}</strong>
            </span>
          </span>
        ))}
      </div>
    );
  };

  const [editingId,  setEditingId]  = useState(null);
  const [editForm,   setEditForm]   = useState({});
  const [showForm,   setShowForm]   = useState(false);
  const [newTask,    setNewTask]    = useState({ title: "", assigned_to: "", status: "Pending", due_date: "", target_date: "", description: "", parent_id: "", is_recurring: false, recurring_frequency: "Monthly", recurring_end_date: "", category: "", priority: "Normal" });
  const [message,    setMessage]    = useState("");
  const [error,      setError]      = useState("");
  const [expandedTasks, setExpandedTasks] = useState({});
  const [subtaskFormFor, setSubtaskFormFor] = useState(null);
  const [newSubtask, setNewSubtask] = useState({ title: "", assigned_to: "", status: "Pending", due_date: "", description: "", level: 1, priority: "Normal" });
  const [employeeTaskFormFor, setEmployeeTaskFormFor] = useState(null);
  const [newEmployeeTask, setNewEmployeeTask] = useState({ title: "", assigned_to: "", status: "Pending", due_date: "", description: "", level: 2, priority: "Normal" });
  const [stats,      setStats]      = useState(null);
  const [activeFilter, setActiveFilter] = useState(null); // "yet_to_start" | "delayed" | "due_today" | "in_progress" | "completed" | null
  const [admins,     setAdmins]     = useState([]);
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);

  const userObj = JSON.parse(sessionStorage.getItem("user")) || {};
  const isLead  = userObj.designation?.toLowerCase().includes("lead");
  const isAdminType = userObj.role === "admin" || userObj.role === "super_admin";

  // An employee/intern can delegate a task ONLY if it's a root task
  // (no parent_id) assigned directly to them — mirrors the backend's
  // one-level-deep enforcement in POST /tasks/assign. Their own delegated
  // children can never be delegated further (hierarchy ends there).
  const canDelegate = (task) =>
    isAdminType || (task.assigned_to === userObj.id && !task.parent_id);

  let readOnly = propReadOnly;
  if (readOnly === undefined) {
    if (userObj.role === "super_admin" || isLead) {
      readOnly = false;
    } else {
      const taskPerm = (userObj.permissions || []).find(p => p.feature_name === "tasks");
      readOnly = !(taskPerm && taskPerm.can_write);
    }
  }

  const canEdit = !readOnly && (userObj.role === "admin" || userObj.role === "super_admin" || isLead);

  useEffect(() => {
    fetchTasks();
    fetchStats();
    if (canEdit) fetchEmployees();
    else fetchEmployeesForTag();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await api.get("/tasks/list");
      setTasks(res.data);
    } catch (err) {
      console.error("TASKS FETCH ERROR:", err);
      setError("Failed to fetch tasks.");
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get("/tasks/my-stats");
      setStats(res.data);
    } catch { /* silent — stats are supplemental */ }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get("/employees/all-assignable");
      const filtered = res.data.filter(u => u.role !== "super_admin");
      setEmployees(filtered);
    } catch {
      try {
        const res = await api.get("/attendance/employees-list");
        const filtered = res.data.filter(u => u.role !== "super_admin");
        setEmployees(filtered);
      } catch { console.error("Could not fetch employees"); }
    }
  };

  // For non-admins: same unrestricted endpoint as admins use, so the
  // "assign colleague" dropdown is actually populated. Also derive the
  // admin list for the @tag/contact dropdown shown to employees.
  const fetchEmployeesForTag = async () => {
    try {
      const res = await api.get("/employees/all-assignable");
      const filtered = res.data.filter(u => u.role !== "super_admin");
      setEmployees(filtered);
      const adminList = res.data.filter(u => u.role === "admin");
      setAdmins(adminList);
    } catch { /* silent */ }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!newTask.title || !newTask.assigned_to) { setError("Title and Assignee are required."); return; }
    try {
      setError(""); setMessage("");
      await api.post("/tasks/assign", newTask);
      fetchTasks(); fetchStats();
      setNewTask({ title: "", assigned_to: "", status: "Pending", due_date: "", target_date: "", description: "", parent_id: "", is_recurring: false, recurring_frequency: "Monthly", recurring_end_date: "", category: "" });
      setShowForm(false);
      setMessage("Task assigned successfully.");
      setTimeout(() => setMessage(""), 3000);
    } catch { setError("Failed to assign task."); }
  };

  const handleSubtaskAssign = async (parentId, level) => {
    const taskData = level === 1 ? newSubtask : newEmployeeTask;
    if (!taskData.title) { setError(`${level === 1 ? "Subtask" : "Work Item"} title is required.`); return; }
    try {
      setError(""); setMessage("");
      await api.post("/tasks/assign", { ...taskData, parent_id: parentId });
      fetchTasks(); fetchStats();
      if (level === 1) {
        setNewSubtask({ title: "", assigned_to: "", status: "Pending", due_date: "", description: "", level: 1 });
        setSubtaskFormFor(null);
      } else {
        setNewEmployeeTask({ title: "", assigned_to: "", status: "Pending", due_date: "", description: "", level: 2 });
        setEmployeeTaskFormFor(null);
      }
      setMessage(`${level === 1 ? "Subtask" : "Work Item"} created successfully.`);
      setTimeout(() => setMessage(""), 3000);
    } catch { setError(`Failed to create ${level === 1 ? "Subtask" : "Work Item"}.`); }
  };

  const handleEditClick = (task) => {
    setEditingId(task.id);
    setEditForm({ ...task, assigned_to: employees.find(e => e.fullname === task.assigned_to_name)?.id || "" });
  };

  const handleSave = async (id) => {
    try {
      await api.put(`/tasks/edit/${id}`, editForm);
      setEditingId(null);
      fetchTasks(); fetchStats();
      setMessage("Task updated.");
      setTimeout(() => setMessage(""), 3000);
    } catch { setError("Failed to update task."); }
  };

  const toggleExpand = (taskId) => {
    setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleHandoff = () => {
    fetchTasks();
    fetchStats();
  };

  
  const applyFilter = (taskList) => {
    if (!activeFilter) return taskList;
    const tdy = new Date().toISOString().split("T")[0];
    return taskList.filter(t => {
      if (activeFilter === "yet_to_start")  return t.status === "Pending" && (!t.due_date || t.due_date.split("T")[0] >= tdy);
      if (activeFilter === "delayed")       return t.status !== "Completed" && t.due_date && t.due_date.split("T")[0] < tdy;
      if (activeFilter === "due_today")     return t.status !== "Completed" && t.due_date?.split("T")[0] === tdy;
      if (activeFilter === "in_progress")   return ["In Progress","Review","On Hold"].includes(t.status);
      if (activeFilter === "completed")     return t.status === "Completed";
      return true;
    });
  };

  const parentTasks = applyFilter(tasks.filter(t => !t.parent_id));
  const getSubtasks = (parentId) => tasks.filter(t => t.parent_id === parentId);

  const handleBack = () => {
    if (onClose) { onClose(); return; }
    const role = userObj.role;
    if (role === "super_admin") navigate("/super-admin-dashboard");
    else if (role === "admin") navigate("/admin-dashboard");
    else navigate("/employee-dashboard");
  };

  const isEmployee = userObj.role === "employee" || (!canEdit && userObj.role !== "admin" && userObj.role !== "super_admin");

  return (
    <div className="tm-wrap">

      <div className="tm-header">
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <h2 className="tm-title">Task Management</h2>
        </div>
        <div className="tm-header-actions">
          {/* Admin Contact Dropdown — visible to employees only */}
          {isEmployee && admins.length > 0 && (
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowAdminDropdown(p => !p)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: showAdminDropdown ? "#4f46e5" : "#eef2ff",
                  color: showAdminDropdown ? "#fff" : "#4f46e5",
                  border: "1.5px solid #c7d2fe",
                  borderRadius: 8, padding: "7px 14px",
                  cursor: "pointer", fontSize: 13, fontWeight: 700,
                  transition: "all 0.15s",
                }}
              >
                <Users size={14} />
                Contact Admin
                {showAdminDropdown ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {showAdminDropdown && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0,
                  background: "#fff", border: "1px solid #e2e8f0",
                  borderRadius: 12, boxShadow: "0 8px 24px rgba(79,70,229,0.13)",
                  zIndex: 200, minWidth: 240, overflow: "hidden",
                  animation: "tmDropIn 0.15s ease-out",
                }}>
                  <div style={{
                    padding: "10px 14px", background: "#f5f3ff",
                    borderBottom: "1px solid #e0e7ff",
                    fontSize: 11, fontWeight: 800, color: "#4f46e5",
                    textTransform: "uppercase", letterSpacing: "0.07em",
                  }}>
                    🛡 Admin Contacts
                  </div>
                  {admins.map(admin => (
                    <div key={admin.id} style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid #f1f5f9",
                      display: "flex", flexDirection: "column", gap: 2,
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>
                        {admin.fullname}
                      </div>
                      {admin.department && (
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {admin.department}
                        </div>
                      )}
                      {admin.email && (
                        <a
                          href={`mailto:${admin.email}`}
                          style={{ fontSize: 11, color: "#4f46e5", textDecoration: "none", fontWeight: 600 }}
                          onClick={e => e.stopPropagation()}
                        >
                          ✉ {admin.email}
                        </a>
                      )}
                    </div>
                  ))}
                  {admins.length === 0 && (
                    <div style={{ padding: "12px 14px", fontSize: 12, color: "#94a3b8" }}>No admins available.</div>
                  )}
                </div>
              )}
            </div>
          )}

          {!readOnly && (userObj.role === "admin") && (
            <button className="tm-add-btn" onClick={() => { setShowForm(!showForm); setSubtaskFormFor(null); setEmployeeTaskFormFor(null); }}>
              New Task
            </button>
          )}
          {!readOnly && userObj.role === "super_admin" && (
            <button className="tm-add-btn" onClick={() => { setShowForm(!showForm); setSubtaskFormFor(null); setEmployeeTaskFormFor(null); }}>
              New Task
            </button>
          )}
          <button
            onClick={handleBack}
            style={{
              background: "#f1f5f9",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "7px 14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: "#64748b",
            }}
          >
            Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes tmDropIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {showForm && (userObj.role === "super_admin" || userObj.role === "admin") && (
        <div className="tm-new-task-form">
          <h3 style={{ margin: "0 0 12px", fontSize: "15px", color: "#4f46e5", fontWeight: "800" }}>
            Create New Master Task
          </h3>
          <form onSubmit={handleAssign} className="tm-form-grid">
            <input placeholder="Task Title *" value={newTask.title}
              onChange={e => setNewTask({ ...newTask, title: e.target.value })} required className="tm-form-input" />

            <select value={newTask.assigned_to}
              onChange={e => setNewTask({ ...newTask, assigned_to: e.target.value })} required className="tm-form-select">
              <option value="">Assign To *</option>
              {employees
                .filter(emp => userObj.role !== "super_admin" || emp.role === "admin")
                .map(emp => (
                <option key={emp.id} value={emp.id}>{emp.fullname}</option>
              ))}
            </select>

            <select value={newTask.priority}
              onChange={e => setNewTask({ ...newTask, priority: e.target.value })} className="tm-form-select">
              <option value="Low">Low Priority</option>
              <option value="Normal">Normal Priority</option>
              <option value="High">High Priority</option>
            </select>

            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "600" }}>Due Date</label>
              <input type="date" value={newTask.due_date}
                onChange={e => setNewTask({ ...newTask, due_date: e.target.value })}
                min={today} max={maxDate}
                className="tm-form-input" />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "600" }}>Target Date</label>
              <input type="date" value={newTask.target_date}
                onChange={e => setNewTask({ ...newTask, target_date: e.target.value })}
                min={today} max={maxDate}
                className="tm-form-input" />
            </div>

            <textarea placeholder="Description (optional)" value={newTask.description}
              onChange={e => setNewTask({ ...newTask, description: e.target.value })} className="tm-form-textarea" rows={2} />

            <RecurringTaskFields
              isRecurring={newTask.is_recurring}
              setIsRecurring={val => setNewTask({ ...newTask, is_recurring: val })}
              recurringFrequency={newTask.recurring_frequency}
              setRecurringFrequency={val => setNewTask({ ...newTask, recurring_frequency: val })}
              recurringEndDate={newTask.recurring_end_date}
              setRecurringEndDate={val => setNewTask({ ...newTask, recurring_end_date: val })}
            />

            {newTask.is_recurring && (
              <input
                placeholder="Category (e.g. Website Maintenance)"
                value={newTask.category}
                onChange={e => setNewTask({ ...newTask, category: e.target.value })}
                className="tm-form-input"
              />
            )}

            <div className="tm-form-actions">
              <button type="submit" className="tm-form-submit">Assign Task</button>
              <button type="button" className="tm-form-cancel" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <TaskStatsPanel
        stats={stats}
        onFilter={(key) => setActiveFilter(activeFilter === key ? null : key)}
      />
      {activeFilter && (
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#4f46e5", fontWeight: 600 }}>
          <span>🔍 Filtered: <strong>{activeFilter.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</strong></span>
          <button onClick={() => setActiveFilter(null)} style={{ background: "none", border: "1px solid #c7d2fe", borderRadius: 6, padding: "2px 10px", fontSize: 12, color: "#4f46e5", cursor: "pointer" }}>Clear Filter</button>
        </div>
      )}

      {canEdit && (
        <div className="tm-bulk-editor-banner">
          <div className="tm-be-left">
            <h3 className="tm-be-title">Bulk Editor Mode</h3>
            <p className="tm-be-desc">Update multiple tasks, track dependencies, and manage target dates in a spreadsheet view.</p>
          </div>
          <button className="tm-be-btn" onClick={() => navigate("/task-spreadsheet")}>
            Open Spreadsheet
          </button>
        </div>
      )}

      <RecurringTasks />

      {error   && <div className="tm-msg tm-msg-error">{error}</div>}
      {message && <div className="tm-msg tm-msg-success">{message}</div>}

      <div className="tm-task-cards">
        {parentTasks.length === 0 && (
          <div className="tm-empty-state">
            <p>
              {activeFilter
                ? "No tasks match this filter."
                : userObj.role === "super_admin"
                  ? "No master tasks found. Create a master task to begin the workflow."
                  : "No tasks assigned to you yet."}
            </p>
          </div>
        )}

        {parentTasks.map(masterTask => {
          const subtasks = getSubtasks(masterTask.id);
          const isMasterExpanded = expandedTasks[masterTask.id];
          const masterStatus = STATUS_COLORS[masterTask.status] || {};

          return (
            <div key={masterTask.id} className="tm-level-0-card">

              <div className="tm-task-row master-row" onClick={() => toggleExpand(masterTask.id)}>
                <div className="tm-task-expand">
                  {isMasterExpanded ? "▼" : "▶"}
                </div>
                <div className="tm-task-info">
                  <div className="tm-task-title-row">
                    <span className="tm-level-badge sa-badge">MASTER</span>
                    <span className="tm-task-id">{masterTask.task_code || `#${masterTask.id}`}</span>
                    <span className="tm-task-name">{masterTask.title}</span>
                  </div>
                  <div className="tm-task-meta">
                    <span>Admin: {masterTask.assigned_to_name || "Unassigned"}</span>
                    {masterTask.due_date && <span> {masterTask.due_date.split("T")[0]}</span>}
                    {masterTask.priority && <span style={{ color: masterTask.priority === 'High' ? 'red' : 'inherit' }}> - {masterTask.priority} Priority</span>}
                  </div>
                </div>
                <div className="tm-task-right" onClick={e => e.stopPropagation()}>
                  <span className="tm-status-pill" style={masterStatus}>{masterTask.status}</span>
                  {!readOnly && userObj.role === "super_admin" && (
                    <button className="tm-icon-btn tm-edit" onClick={() => handleEditClick(masterTask)}>Edit</button>
                  )}
                  {canDelegate(masterTask) && (
                    <button
                      className="tm-icon-btn tm-add-sub"
                      title="Split this task among others"
                      onClick={() => setSubtaskFormFor(subtaskFormFor === masterTask.id ? null : masterTask.id)}
                    >
                      +
                    </button>
                  )}
                </div>
              </div>

              <div style={{ marginLeft: 20, marginBottom: 4 }} onClick={e => e.stopPropagation()}>
                <TaskCommentBox
                  task={masterTask}
                  employees={employees}
                  currentUserId={userObj.id}
                  onHandoff={handleHandoff}
                />
              </div>

              {editingId === masterTask.id && (
                <div className="tm-edit-form" onClick={e => e.stopPropagation()}>
                  <input value={editForm.title || ""} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="tm-form-input" placeholder="Title" />
                  <select value={editForm.status || "Pending"} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="tm-form-select">
                    {Object.keys(STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
                  </select>
                  <select value={editForm.priority || "Normal"} onChange={e => setEditForm({ ...editForm, priority: e.target.value })} className="tm-form-select">
                    <option value="Low">Low Priority</option>
                    <option value="Normal">Normal Priority</option>
                    <option value="High">High Priority</option>
                  </select>
                  <select value={editForm.assigned_to || ""} onChange={e => setEditForm({ ...editForm, assigned_to: e.target.value })} className="tm-form-select">
                    <option value="">Assign To</option>
                    {employees
                      .filter(emp => userObj.role !== "super_admin" || emp.role === "admin")
                      .map(emp => <option key={emp.id} value={emp.id}>{emp.fullname}</option>)}
                  </select>

                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "600" }}>Due Date</label>
                    <input type="date" value={editForm.due_date?.split("T")[0] || ""}
                      onChange={e => setEditForm({ ...editForm, due_date: e.target.value })}
                      min={today} max={maxDate}
                      className="tm-form-input" />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "600" }}>Target Date</label>
                    <input type="date" value={editForm.target_date || ""}
                      onChange={e => setEditForm({ ...editForm, target_date: e.target.value })}
                      min={today} max={maxDate}
                      className="tm-form-input" />
                  </div>

                  <div className="tm-form-actions">
                    <button className="tm-form-submit" onClick={() => handleSave(masterTask.id)}>Save</button>
                    <button className="tm-form-cancel" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              )}

              {subtaskFormFor === masterTask.id && (
                <div className="tm-subtask-form">
                  <div className="tm-sf-header">
                    {isAdminType ? "New Project Subtask for Admin" : "Split this task with a colleague"}
                  </div>
                  <div className="tm-sf-row">
                    <input
                      placeholder="Subtask Title *"
                      value={newSubtask.title}
                      onChange={e => setNewSubtask({ ...newSubtask, title: e.target.value })}
                      className="tm-form-input"
                    />
                    <select
                      value={newSubtask.assigned_to}
                      onChange={e => setNewSubtask({ ...newSubtask, assigned_to: e.target.value })}
                      className="tm-form-select"
                    >
                      <option value="">{isAdminType ? "Assign Admin/TL" : "Assign Colleague"}</option>
                      {employees
                        .filter(emp => {
                          if (userObj.role === "super_admin") return emp.role === "admin";
                          if (userObj.role === "admin") return true;
                          // Employee delegating: only to fellow employees/interns —
                          // any department, since assignment isn't department-filtered.
                          return emp.role === "employee" || emp.role === "intern";
                        })
                        .map(emp => <option key={emp.id} value={emp.id}>{emp.fullname}{emp.department ? ` — ${emp.department}` : ""}</option>)}
                    </select>
                    <select
                      value={newSubtask.priority}
                      onChange={e => setNewSubtask({ ...newSubtask, priority: e.target.value })}
                      className="tm-form-select"
                    >
                      <option value="Low">Low</option>
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                    </select>
                    <button className="tm-sf-btn" onClick={() => handleSubtaskAssign(masterTask.id, 1)}>Add Subtask</button>
                  </div>
                </div>
              )}

              {isMasterExpanded && subtasks.map(subtask => {
                const employeeTasks = getSubtasks(subtask.id);
                const isSubExpanded = expandedTasks[subtask.id];
                const subStatus = STATUS_COLORS[subtask.status] || {};

                return (
                  <div key={subtask.id} className="tm-level-1-container">
                    <div className="tm-task-row subtask-row" onClick={() => toggleExpand(subtask.id)}>
                      <div className="tm-task-expand" style={{ marginLeft: 20 }}>
                        {isSubExpanded ? "▼" : "▶"}
                      </div>
                      <div className="tm-task-info">
                        <div className="tm-task-title-row">
                          <span className="tm-level-badge admin-badge">SUBTASK</span>
                          <span className="tm-task-id">{subtask.task_code || `#${subtask.id}`}</span>
                          <span className="tm-task-name">{subtask.title}</span>
                        </div>
                        <div className="tm-task-meta">
                          <span>Owner: {subtask.assigned_to_name || "Unassigned"}</span>
                          {subtask.priority && <span style={{ color: subtask.priority === 'High' ? 'red' : 'inherit' }}> - {subtask.priority} Priority</span>}
                        </div>
                        <TaskChainBreadcrumb taskId={subtask.id} />
                      </div>
                      <div className="tm-task-right" onClick={e => e.stopPropagation()}>
                        <span className="tm-status-pill small" style={subStatus}>{subtask.status}</span>
                        {!readOnly && (userObj.role === "admin" || userObj.role === "super_admin") && (
                          <button
                            className="tm-icon-btn tm-add-sub"
                            title="Add Employee Work Item"
                            onClick={() => setEmployeeTaskFormFor(employeeTaskFormFor === subtask.id ? null : subtask.id)}
                          >
                            +
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ marginLeft: 40, marginBottom: 4 }} onClick={e => e.stopPropagation()}>
                      <TaskCommentBox
                        task={subtask}
                        employees={employees}
                        currentUserId={userObj.id}
                        onHandoff={handleHandoff}
                      />
                    </div>

                    {employeeTaskFormFor === subtask.id && (
                      <div className="tm-subtask-form" style={{ marginLeft: 40 }}>
                        <div className="tm-sf-header">New Work Item for Employee</div>
                        <div className="tm-sf-row">
                          <input
                            placeholder="Work Item Title *"
                            value={newEmployeeTask.title}
                            onChange={e => setNewEmployeeTask({ ...newEmployeeTask, title: e.target.value })}
                            className="tm-form-input"
                          />
                          <select
                            value={newEmployeeTask.assigned_to}
                            onChange={e => setNewEmployeeTask({ ...newEmployeeTask, assigned_to: e.target.value })}
                            className="tm-form-select"
                          >
                            <option value="">Assign Employee</option>
                            {employees
                              .filter(emp => userObj.role !== "super_admin" || emp.role === "admin")
                              .map(emp => <option key={emp.id} value={emp.id}>{emp.fullname}</option>)}
                          </select>
                          <select
                            value={newEmployeeTask.priority}
                            onChange={e => setNewEmployeeTask({ ...newEmployeeTask, priority: e.target.value })}
                            className="tm-form-select"
                          >
                            <option value="Low">Low</option>
                            <option value="Normal">Normal</option>
                            <option value="High">High</option>
                          </select>
                          <button className="tm-sf-btn" onClick={() => handleSubtaskAssign(subtask.id, 2)}>Add Work Task</button>
                        </div>
                      </div>
                    )}

                    {isSubExpanded && employeeTasks.map(empTask => {
                      const empStatus = STATUS_COLORS[empTask.status] || {};
                      const isMyTask  = empTask.assigned_to === userObj.id || String(empTask.assigned_to) === String(userObj.id);
                      return (
                        <div key={empTask.id} style={{ marginLeft: 60 }}>
                          <div className="tm-task-row employee-row">
                            <div className="tm-task-info">
                              <div className="tm-task-title-row">
                                <span className="tm-level-badge emp-badge">TASK</span>
                                <span className="tm-task-id">{empTask.task_code || `#${empTask.id}`}</span>
                                <span className="tm-task-name">{empTask.title}</span>
                              </div>
                              <div className="tm-task-meta">
                                <span>Assigned to: {empTask.assigned_to_name}</span>
                                {empTask.due_date && <span> {empTask.due_date.split("T")[0]}</span>}
                                {empTask.priority && <span style={{ color: empTask.priority === 'High' ? 'red' : 'inherit' }}> - {empTask.priority} Priority</span>}
                              </div>
                              <TaskChainBreadcrumb taskId={empTask.id} />
                            </div>
                            <div className="tm-task-right">
                              <span className="tm-status-pill tiny" style={empStatus}>{empTask.status}</span>
                            </div>
                          </div>

                          
                          <div style={{ marginLeft: 20, marginBottom: 4 }}>
                            <TaskCommentBox
                              task={empTask}
                              employees={employees}
                              currentUserId={userObj.id}
                              onHandoff={handleHandoff}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}