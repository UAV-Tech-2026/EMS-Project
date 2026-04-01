import React, { useState, useEffect } from "react";
import { api } from "../utils/api";
import "../styles/TaskManagement.css";
import { Calendar, List, Plus, Edit2, Check, X } from "lucide-react";

const STATUS_COLORS = {
  "Pending":     { bg: "#fef9c3", color: "#854d0e" },
  "In Progress": { bg: "#dbeafe", color: "#1d4ed8" },
  "On Hold":     { bg: "#fee2e2", color: "#b91c1c" },
  "Completed":   { bg: "#dcfce7", color: "#15803d" },
  "Review":      { bg: "#f3e8ff", color: "#7c3aed" },
};

export default function TaskManagement() {
  const [tasks,      setTasks]      = useState([]);
  const [employees,  setEmployees]  = useState([]);
  const [view,       setView]       = useState("list"); // "list" | "calendar"
  const [editingId,  setEditingId]  = useState(null);
  const [editForm,   setEditForm]   = useState({});
  const [showForm,   setShowForm]   = useState(false);
  const [newTask,    setNewTask]    = useState({ title: "", assigned_to: "", status: "Pending", due_date: "", man_hours: "" });
  const [message,    setMessage]    = useState("");
  const [error,      setError]      = useState("");
  const [calMonth,   setCalMonth]   = useState(new Date());

  const userObj  = JSON.parse(localStorage.getItem("user")) || {};
  const isLead   = userObj.designation?.toLowerCase().includes("lead");
  const canEdit  = userObj.role === "admin" || userObj.role === "super_admin" || isLead;

  useEffect(() => { fetchTasks(); fetchEmployees(); }, []);

  const fetchTasks = async () => {
    try {
      const res = await api.get("/tasks/list");
      if (canEdit) {
        setTasks(res.data);
      } else {
        setTasks(res.data.filter(t => t.assigned_to_name === userObj.fullname));
      }
    } catch { setError("Failed to fetch tasks."); }
  };

  // Fetch all users who can be assigned tasks
  const fetchEmployees = async () => {
    try {
      // Try the full assignable list first (includes admin + super_admin)
      const res = await api.get("/attendance/employees-list");
      setEmployees(res.data);
    } catch {
      try {
        const res = await api.get("/employees/list");
        setEmployees(res.data);
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
      setNewTask({ title: "", assigned_to: "", status: "Pending", due_date: "", man_hours: "" });
      setShowForm(false);
      setMessage("Task assigned successfully.");
      setTimeout(() => setMessage(""), 3000);
    } catch { setError("Failed to assign task."); }
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

  // ── CALENDAR HELPERS ──
  const getDaysInMonth = (date) => {
    const y = date.getFullYear(), m = date.getMonth();
    const first = new Date(y, m, 1).getDay();
    const days  = new Date(y, m + 1, 0).getDate();
    return { first, days };
  };

  const getTasksForDay = (day) => {
    const y = calMonth.getFullYear(), m = String(calMonth.getMonth() + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;
    return tasks.filter(t => t.due_date && t.due_date.startsWith(dateStr));
  };

  const prevMonth = () => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1));
  const nextMonth = () => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1));

  const { first, days } = getDaysInMonth(calMonth);
  const monthName = calMonth.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="tm-wrap">

      {/* ── Header ── */}
      <div className="tm-header">
        <div>
          <h2 className="tm-title">Task Management</h2>
          <p className="tm-sub">
            {canEdit ? "All tasks across your organisation" : `My tasks — ${userObj.fullname}`}
          </p>
        </div>
        <div className="tm-header-actions">
          {/* View toggle */}
          <div className="tm-view-toggle">
            <button className={`tm-toggle-btn ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}>
              <List size={14} /> List
            </button>
            <button className={`tm-toggle-btn ${view === "calendar" ? "active" : ""}`} onClick={() => setView("calendar")}>
              <Calendar size={14} /> Calendar
            </button>
          </div>
          {canEdit && (
            <button className="tm-add-btn" onClick={() => setShowForm(!showForm)}>
              <Plus size={14} /> Assign Task
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      {error   && <div className="tm-msg tm-msg-error">{error}</div>}
      {message && <div className="tm-msg tm-msg-success">{message}</div>}

      {/* ── Assign Form ── */}
      {canEdit && showForm && (
        <form className="tm-form" onSubmit={handleAssign}>
          <input className="tm-input" placeholder="Task title *" value={newTask.title}
            onChange={e => setNewTask({ ...newTask, title: e.target.value })} />
          <select className="tm-select" value={newTask.assigned_to}
            onChange={e => setNewTask({ ...newTask, assigned_to: e.target.value })}>
            <option value="">Assign to *</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.fullname} ({emp.role})</option>
            ))}
          </select>
          <input className="tm-input" type="date" value={newTask.due_date}
            onChange={e => setNewTask({ ...newTask, due_date: e.target.value })} />
          <input className="tm-input" type="number" placeholder="Man hours" value={newTask.man_hours}
            onChange={e => setNewTask({ ...newTask, man_hours: e.target.value })} />
          <select className="tm-select" value={newTask.status}
            onChange={e => setNewTask({ ...newTask, status: e.target.value })}>
            <option>Pending</option><option>In Progress</option>
            <option>On Hold</option><option>Completed</option><option>Review</option>
          </select>
          <div className="tm-form-actions">
            <button type="submit" className="tm-btn-primary">Assign</button>
            <button type="button" className="tm-btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <div className="tm-table-wrap">
          <table className="tm-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Task</th>
                <th>Assignee</th>
                <th>Due Date</th>
                <th>Man Hrs</th>
                <th>Status</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 && (
                <tr><td colSpan={canEdit ? 7 : 6} className="tm-empty">No tasks found</td></tr>
              )}
              {tasks.map((task, i) => (
                <tr key={task.id}>
                  <td className="tm-td-num">{i + 1}</td>

                  {editingId === task.id ? (
                    <>
                      <td><input className="tm-inline-input" name="title" value={editForm.title}
                        onChange={e => setEditForm({ ...editForm, title: e.target.value })} /></td>
                      <td>
                        <select className="tm-inline-select" name="assigned_to" value={editForm.assigned_to}
                          onChange={e => setEditForm({ ...editForm, assigned_to: e.target.value })}>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.fullname}</option>
                          ))}
                        </select>
                      </td>
                      <td><input className="tm-inline-input" type="date" name="due_date" value={editForm.due_date?.split("T")[0] || ""}
                        onChange={e => setEditForm({ ...editForm, due_date: e.target.value })} /></td>
                      <td><input className="tm-inline-input" type="number" name="man_hours" value={editForm.man_hours || ""}
                        onChange={e => setEditForm({ ...editForm, man_hours: e.target.value })} /></td>
                      <td>
                        <select className="tm-inline-select" name="status" value={editForm.status}
                          onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                          <option>Pending</option><option>In Progress</option>
                          <option>On Hold</option><option>Completed</option><option>Review</option>
                        </select>
                      </td>
                      <td>
                        <button className="tm-icon-btn tm-save" onClick={() => handleSave(task.id)}><Check size={14} /></button>
                        <button className="tm-icon-btn tm-cancel" onClick={() => setEditingId(null)}><X size={14} /></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="tm-td-title">{task.title}</td>
                      <td className="tm-td-name">{task.assigned_to_name || "—"}</td>
                      <td className="tm-td-date">{task.due_date ? task.due_date.split("T")[0] : "—"}</td>
                      <td className="tm-td-hrs">{task.man_hours || "—"}</td>
                      <td>
                        <span className="tm-status-pill" style={STATUS_COLORS[task.status] || {}}>
                          {task.status}
                        </span>
                      </td>
                      {canEdit && (
                        <td>
                          <button className="tm-icon-btn tm-edit" onClick={() => handleEditClick(task)}>
                            <Edit2 size={13} />
                          </button>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CALENDAR VIEW ── */}
      {view === "calendar" && (
        <div className="tm-calendar">
          <div className="tm-cal-nav">
            <button className="tm-cal-arrow" onClick={prevMonth}>‹</button>
            <span className="tm-cal-month">{monthName}</span>
            <button className="tm-cal-arrow" onClick={nextMonth}>›</button>
          </div>
          <div className="tm-cal-grid">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
              <div key={d} className="tm-cal-dayname">{d}</div>
            ))}
            {Array.from({ length: first }).map((_, i) => (
              <div key={`empty-${i}`} className="tm-cal-cell tm-cal-empty" />
            ))}
            {Array.from({ length: days }, (_, i) => i + 1).map(day => {
              const dayTasks = getTasksForDay(day);
              const isToday = new Date().getDate() === day &&
                new Date().getMonth() === calMonth.getMonth() &&
                new Date().getFullYear() === calMonth.getFullYear();
              return (
                <div key={day} className={`tm-cal-cell ${isToday ? "tm-cal-today" : ""}`}>
                  <span className="tm-cal-dnum">{day}</span>
                  {dayTasks.map(t => (
                    <div key={t.id} className="tm-cal-task"
                      style={STATUS_COLORS[t.status] || { bg: "#f1f5f9", color: "#475569" }}>
                      <span style={{ fontSize: "10px", fontWeight: 500,
                        background: (STATUS_COLORS[t.status] || {}).bg,
                        color: (STATUS_COLORS[t.status] || {}).color,
                        padding: "1px 6px", borderRadius: "4px", display: "block",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.title}
                      </span>
                      {canEdit && (
                        <span style={{ fontSize: "9px", color: "#94a3b8", display: "block" }}>
                          {t.assigned_to_name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
