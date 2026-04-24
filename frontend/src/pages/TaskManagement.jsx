import React, { useState, useEffect } from "react";
import { api } from "../utils/api";
import { useNavigate } from "react-router-dom";
import "../styles/TaskManagement.css";
import { List, Plus, Edit2, Check, X, FileSpreadsheet, ArrowLeft, ChevronDown, ChevronRight, Layers } from "lucide-react";

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

export default function TaskManagement({ onClose }) {
  const navigate     = useNavigate();
  const [tasks,      setTasks]      = useState([]);
  const [employees,  setEmployees]  = useState([]);
  const [editingId,  setEditingId]  = useState(null);
  const [editForm,   setEditForm]   = useState({});
  const [showForm,   setShowForm]   = useState(false);
  const [newTask,    setNewTask]    = useState({ title: "", assigned_to: "", status: "Pending", due_date: "", target_date: "", description: "", parent_id: "" });
  const [message,    setMessage]    = useState("");
  const [error,      setError]      = useState("");
  const [expandedTasks, setExpandedTasks] = useState({});
  const [subtaskFormFor, setSubtaskFormFor] = useState(null);
  const [newSubtask, setNewSubtask] = useState({ title: "", assigned_to: "", status: "Pending", due_date: "", description: "", level: 1 });
  const [employeeTaskFormFor, setEmployeeTaskFormFor] = useState(null);
  const [newEmployeeTask, setNewEmployeeTask] = useState({ title: "", assigned_to: "", status: "Pending", due_date: "", description: "", level: 2 });

  const userObj = JSON.parse(localStorage.getItem("user")) || {};
  const isLead  = userObj.designation?.toLowerCase().includes("lead");
  const canEdit = userObj.role === "admin" || userObj.role === "admin_hr" || userObj.role === "super_admin" || isLead;

  useEffect(() => {
    fetchTasks();
    if (canEdit) fetchEmployees();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await api.get("/tasks/list");
      const allTasks = res.data;

      if (canEdit) {
        setTasks(allTasks);
      } else {
        const myUserId = userObj.id;
        const myTaskIds = new Set(
          allTasks.filter(t => t.assigned_to === myUserId).map(t => t.id)
        );
        const ancestorIds = new Set();
        allTasks.forEach(t => {
          if (myTaskIds.has(t.id) && t.parent_id) {
            ancestorIds.add(t.parent_id);
            const parent = allTasks.find(p => p.id === t.parent_id);
            if (parent?.parent_id) ancestorIds.add(parent.parent_id);
          }
        });
        setTasks(allTasks.filter(t => myTaskIds.has(t.id) || ancestorIds.has(t.id)));
      }
    } catch { setError("Failed to fetch tasks."); }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get("/employees/all-assignable");
      // ── Remove super_admin from assignable dropdown ──
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

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!newTask.title || !newTask.assigned_to) { setError("Title and Assignee are required."); return; }
    try {
      setError(""); setMessage("");
      await api.post("/tasks/assign", newTask);
      fetchTasks();
      setNewTask({ title: "", assigned_to: "", status: "Pending", due_date: "", target_date: "", description: "", parent_id: "" });
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
      fetchTasks();
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
      fetchTasks();
      setMessage("Task updated.");
      setTimeout(() => setMessage(""), 3000);
    } catch { setError("Failed to update task."); }
  };

  const toggleExpand = (taskId) => {
    setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const parentTasks = tasks.filter(t => !t.parent_id);
  const getSubtasks = (parentId) => tasks.filter(t => t.parent_id === parentId);

  // ── Close / Back handler — always works whether modal or page ──
  const handleBack = () => {
    if (onClose) { onClose(); return; }
    const role = userObj.role;
    if (role === "super_admin") navigate("/super-admin-dashboard");
    else if (role === "admin_hr") navigate("/admin-dashboard");
    else if (role === "admin") navigate("/admin-dashboard");
    else navigate("/employee-dashboard");
  };

  return (
    <div className="tm-wrap">

      {/* ── Header ── */}
      <div className="tm-header">
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <h2 className="tm-title">Task Management</h2>
        </div>
        <div className="tm-header-actions">
          {(userObj.role === "admin" || userObj.role === "admin_hr") && (
            <button className="tm-add-btn" onClick={() => { setShowForm(!showForm); setSubtaskFormFor(null); setEmployeeTaskFormFor(null); }}>
              <Plus size={16} /> New Task
            </button>
          )}
          {/* ── Super Admin: New Task button (no SA in dropdown) ── */}
          {userObj.role === "super_admin" && (
            <button className="tm-add-btn" onClick={() => { setShowForm(!showForm); setSubtaskFormFor(null); setEmployeeTaskFormFor(null); }}>
              <Plus size={16} /> New Task
            </button>
          )}
          {/* ── Close button — visible for ALL roles ── */}
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
            <X size={15} /> Close
          </button>
        </div>
      </div>

      {/* ── Bulk Editor Banner (admin/super_admin only) ── */}
      {canEdit && (
        <div className="tm-bulk-editor-banner">
          <div className="tm-be-left">
            <h3 className="tm-be-title">Bulk Editor Mode</h3>
            <p className="tm-be-desc">Update multiple tasks, track dependencies, and manage target dates in a spreadsheet view.</p>
          </div>
          <button className="tm-be-btn" onClick={() => navigate("/task-spreadsheet")}>
            <FileSpreadsheet size={16} /> Open Spreadsheet
          </button>
        </div>
      )}

      {/* ── New Master Task Form ── */}
      {showForm && (userObj.role === "super_admin" || userObj.role === "admin" || userObj.role === "admin_hr") && (
        <div className="tm-new-task-form">
          <h3 style={{ margin: "0 0 12px", fontSize: "15px", color: "#4f46e5", fontWeight: "800" }}>
            <Layers size={16} style={{ verticalAlign: "middle", marginRight: 6 }} /> Create New Master Task
          </h3>
          <form onSubmit={handleAssign} className="tm-form-grid">
            <input placeholder="Task Title *" value={newTask.title}
              onChange={e => setNewTask({ ...newTask, title: e.target.value })} required className="tm-form-input" />

            {/* ── Assign To: super_admin excluded ── */}
            <select value={newTask.assigned_to}
              onChange={e => setNewTask({ ...newTask, assigned_to: e.target.value })} required className="tm-form-select">
              <option value="">Assign To *</option>
              {employees
                .filter(emp => userObj.role !== "super_admin" || emp.role === "admin" || emp.role === "admin_hr")
                .map(emp => (
                <option key={emp.id} value={emp.id}>{emp.fullname}</option>
              ))}
            </select>

            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "600" }}>Assigned Date</label>
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
            <div className="tm-form-actions">
              <button type="submit" className="tm-form-submit">Assign Task</button>
              <button type="button" className="tm-form-cancel" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Messages ── */}
      {error   && <div className="tm-msg tm-msg-error">{error}</div>}
      {message && <div className="tm-msg tm-msg-success">{message}</div>}

      {/* ── TASK LIST WITH 3-LEVEL HIERARCHY ── */}
      <div className="tm-task-cards">
        {parentTasks.length === 0 && (
          <div className="tm-empty-state">
            <Layers size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p>
              {userObj.role === "super_admin"
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
              {/* ── LEVEL 0: MASTER TASK ── */}
              <div className="tm-task-row master-row" onClick={() => toggleExpand(masterTask.id)}>
                <div className="tm-task-expand">
                  {isMasterExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
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
                  </div>
                </div>
                <div className="tm-task-right" onClick={e => e.stopPropagation()}>
                  <span className="tm-status-pill" style={masterStatus}>{masterTask.status}</span>
                  {userObj.role === "super_admin" && (
                    <button className="tm-icon-btn tm-edit" onClick={() => handleEditClick(masterTask)}><Edit2 size={13} /></button>
                  )}
                  {(userObj.role === "super_admin" || userObj.role === "admin" || userObj.role === "admin_hr") && (
                    <button
                      className="tm-icon-btn tm-add-sub"
                      title="Add Project Subtask"
                      onClick={() => setSubtaskFormFor(subtaskFormFor === masterTask.id ? null : masterTask.id)}
                    >
                      <Plus size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* ── Edit form for master task ── */}
              {editingId === masterTask.id && (
                <div className="tm-edit-form" onClick={e => e.stopPropagation()}>
                  <input value={editForm.title || ""} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="tm-form-input" placeholder="Title" />
                  <select value={editForm.status || "Pending"} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="tm-form-select">
                    {Object.keys(STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
                  </select>
                  <select value={editForm.assigned_to || ""} onChange={e => setEditForm({ ...editForm, assigned_to: e.target.value })} className="tm-form-select">
                    <option value="">Assign To</option>
                    {employees
                      .filter(emp => userObj.role !== "super_admin" || emp.role === "admin" || emp.role === "admin_hr")
                      .map(emp => <option key={emp.id} value={emp.id}>{emp.fullname}</option>)}
                  </select>

                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "600" }}>Assigned Date</label>
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
                    <button className="tm-form-submit" onClick={() => handleSave(masterTask.id)}><Check size={13} /> Save</button>
                    <button className="tm-form-cancel" onClick={() => setEditingId(null)}><X size={13} /> Cancel</button>
                  </div>
                </div>
              )}

              {/* ── Subtask Form ── */}
              {subtaskFormFor === masterTask.id && (
                <div className="tm-subtask-form">
                  <div className="tm-sf-header"><Plus size={12} /> New Project Subtask for Admin</div>
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
                      <option value="">Assign Admin/TL</option>
                      {employees
                        .filter(emp => userObj.role !== "super_admin" || emp.role === "admin" || emp.role === "admin_hr")
                        .map(emp => <option key={emp.id} value={emp.id}>{emp.fullname}</option>)}
                    </select>
                    <button className="tm-sf-btn" onClick={() => handleSubtaskAssign(masterTask.id, 1)}>Add Subtask</button>
                  </div>
                </div>
              )}

              {/* ── LEVEL 1: SUBTASKS ── */}
              {isMasterExpanded && subtasks.map(subtask => {
                const employeeTasks = getSubtasks(subtask.id);
                const isSubExpanded = expandedTasks[subtask.id];
                const subStatus = STATUS_COLORS[subtask.status] || {};

                return (
                  <div key={subtask.id} className="tm-level-1-container">
                    <div className="tm-task-row subtask-row" onClick={() => toggleExpand(subtask.id)}>
                      <div className="tm-task-expand" style={{ marginLeft: 20 }}>
                        {isSubExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                      <div className="tm-task-info">
                        <div className="tm-task-title-row">
                          <span className="tm-level-badge admin-badge">SUBTASK</span>
                          <span className="tm-task-id">{subtask.task_code || `#${subtask.id}`}</span>
                          <span className="tm-task-name">{subtask.title}</span>
                        </div>
                        <div className="tm-task-meta">
                          <span>Owner: {subtask.assigned_to_name || "Unassigned"}</span>
                        </div>
                      </div>
                      <div className="tm-task-right" onClick={e => e.stopPropagation()}>
                        <span className="tm-status-pill small" style={subStatus}>{subtask.status}</span>
                        {(userObj.role === "admin" || userObj.role === "admin_hr" || userObj.role === "super_admin") && (
                          <button
                            className="tm-icon-btn tm-add-sub"
                            title="Add Employee Work Item"
                            onClick={() => setEmployeeTaskFormFor(employeeTaskFormFor === subtask.id ? null : subtask.id)}
                          >
                            <Plus size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ── Employee Task Form ── */}
                    {employeeTaskFormFor === subtask.id && (
                      <div className="tm-subtask-form" style={{ marginLeft: 40 }}>
                        <div className="tm-sf-header"><Plus size={12} /> New Work Item for Employee</div>
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
                              .filter(emp => userObj.role !== "super_admin" || emp.role === "admin" || emp.role === "admin_hr")
                              .map(emp => <option key={emp.id} value={emp.id}>{emp.fullname}</option>)}
                          </select>
                          <button className="tm-sf-btn" onClick={() => handleSubtaskAssign(subtask.id, 2)}>Add Work Task</button>
                        </div>
                      </div>
                    )}

                    {/* ── LEVEL 2: EMPLOYEE WORK ITEMS ── */}
                    {isSubExpanded && employeeTasks.map(empTask => {
                      const empStatus = STATUS_COLORS[empTask.status] || {};
                      return (
                        <div key={empTask.id} className="tm-task-row employee-row" style={{ marginLeft: 60 }}>
                          <div className="tm-task-info">
                            <div className="tm-task-title-row">
                              <span className="tm-level-badge emp-badge">TASK</span>
                              <span className="tm-task-id">{empTask.task_code || `#${empTask.id}`}</span>
                              <span className="tm-task-name">{empTask.title}</span>
                            </div>
                            <div className="tm-task-meta">
                              <span>Assigned to: {empTask.assigned_to_name}</span>
                              {empTask.due_date && <span> {empTask.due_date.split("T")[0]}</span>}
                            </div>
                          </div>
                          <div className="tm-task-right">
                            <span className="tm-status-pill tiny" style={empStatus}>{empTask.status}</span>
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
