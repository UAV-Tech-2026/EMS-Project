import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import "../styles/TaskSpreadsheet.css";
import { Save, Plus, Trash2, ArrowLeft, Download } from "lucide-react";

export default function TaskSpreadsheet() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [taskRes, empRes] = await Promise.all([
        api.get("/tasks/list"),
        api.get("/employees/list")
      ]);
      
      // Initialize with existing tasks or an empty row if none
      const existingTasks = taskRes.data.map(t => ({
        id: t.id,
        title: t.title || "",
        assigned_to: employees.find(e => e.fullname === t.assigned_to_name)?.id || "",
        reviewed_by: employees.find(e => e.fullname === t.reviewed_by)?.id || "",
        man_hours: t.man_hours || "",
        start_date: t.start_date ? t.start_date.split('T')[0] : "",
        due_date: t.due_date ? t.due_date.split('T')[0] : "",
        end_date: t.end_date ? t.end_date.split('T')[0] : "",
        status: t.status || "Pending",
        days_taken: t.days_taken || "",
        depends_on: t.depends_on || "",
        link: t.link || "",
        isNew: false
      }));

      // Wait for employees to be set before mapping names to IDs properly if needed
      // Actually, let's just set employees first then map
      setEmployees(empRes.data);
      
      const mappedTasks = taskRes.data.map(t => ({
        id: t.id,
        title: t.title || "",
        assigned_to: empRes.data.find(e => e.fullname === t.assigned_to_name)?.id || "",
        reviewed_by: empRes.data.find(e => e.fullname === t.reviewed_by)?.id || "",
        man_hours: t.man_hours || "",
        start_date: t.start_date ? t.start_date.split('T')[0] : "",
        due_date: t.due_date ? t.due_date.split('T')[0] : "",
        end_date: t.end_date ? t.end_date.split('T')[0] : "",
        status: t.status || "Pending",
        days_taken: t.days_taken || "",
        depends_on: t.depends_on || "",
        link: t.link || "",
        isNew: false
      }));

      setTasks(mappedTasks.length > 0 ? mappedTasks : [getEmptyRow()]);
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Failed to load data" });
    } finally {
      setLoading(false);
    }
  };

  const getEmptyRow = () => ({
    id: Date.now() + Math.random(),
    title: "",
    assigned_to: "",
    reviewed_by: "",
    man_hours: "",
    start_date: "",
    due_date: "",
    end_date: "",
    status: "Pending",
    days_taken: "",
    depends_on: "",
    link: "",
    isNew: true
  });

  const handleAddRow = () => {
    setTasks([...tasks, getEmptyRow()]);
  };

  const handleChange = (id, field, value) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleDeleteRow = (id, isNew) => {
    if (window.confirm("Are you sure you want to remove this row?")) {
      setTasks(tasks.filter(t => t.id !== id));
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage({ type: "", text: "" });

      // Separate new tasks from existing ones for backend logic if needed
      // For simplicity, we can just send everything to a bulk endpoint if it exists,
      // or loop through and save. Since we don't have a bulk sync endpoint yet,
      // we'll loop or just focus on the new ones/edited ones.
      
      const promises = tasks.map(t => {
        if (t.isNew) {
          if (!t.title) return null; // Skip empty rows
          return api.post("/tasks/assign", t);
        } else {
          return api.put(`/tasks/edit/${t.id}`, t);
        }
      }).filter(p => p !== null);

      await Promise.all(promises);
      setMessage({ type: "success", text: "All changes saved successfully!" });
      fetchInitialData(); // Refresh to get proper IDs and clean state
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Error saving data. Some changes might not have been recorded." });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    // Current export logic from TaskManagement can be reused or simplified
    window.open(`${import.meta.env.VITE_API_URL}/tasks/download-excel?token=${localStorage.getItem("token")}`, "_blank");
  };

  if (loading) return <div className="spreadsheet-loading">Loading Spreadsheet...</div>;

  return (
    <div className="spreadsheet-page">
      <header className="spreadsheet-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate("/task-management")}>
            <ArrowLeft size={18} /> Back
          </button>
          <h1>Task Master Sheet</h1>
        </div>
        <div className="header-actions">
          {message.text && (
            <span className={`status-msg ${message.type}`}>{message.text}</span>
          )}
          <button className="action-btn export" onClick={handleExport}>
            <Download size={18} /> Export Excel
          </button>
          <button className="action-btn add" onClick={handleAddRow}>
            <Plus size={18} /> Add Row
          </button>
          <button className="action-btn save" onClick={handleSave} disabled={saving}>
            <Save size={18} /> {saving ? "Saving..." : "Save to Database"}
          </button>
        </div>
      </header>

      <div className="table-container">
        <table className="excel-table">
          <thead>
            <tr>
              <th className="col-action"></th>
              <th className="col-task">TASK</th>
              <th className="col-user">Assigned to</th>
              <th className="col-user">Reviewed by</th>
              <th className="col-hours">Man hours</th>
              <th className="col-date">Start Date</th>
              <th className="col-date">Est. Closure Date</th>
              <th className="col-date">End Date</th>
              <th className="col-status">STATUS</th>
              <th className="col-days">No of days taken</th>
              <th className="col-dep">Dependencies if any</th>
              <th className="col-link">LINK if any</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task, index) => (
              <tr key={task.id}>
                <td className="cell-action">
                  <button className="row-delete" onClick={() => handleDeleteRow(task.id, task.isNew)}>
                    <Trash2 size={14} />
                  </button>
                </td>
                <td className="cell-input">
                  <input 
                    type="text" 
                    value={task.title} 
                    onChange={(e) => handleChange(task.id, "title", e.target.value)}
                    placeholder="Enter task name..."
                  />
                </td>
                <td className="cell-input">
                  <select 
                    value={task.assigned_to} 
                    onChange={(e) => handleChange(task.id, "assigned_to", e.target.value)}
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.fullname}</option>
                    ))}
                  </select>
                </td>
                <td className="cell-input">
                  <select 
                    value={task.reviewed_by} 
                    onChange={(e) => handleChange(task.id, "reviewed_by", e.target.value)}
                  >
                    <option value="">Select Reviewer</option>
                    {employees.filter(e => e.role !== "employee").map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.fullname}</option>
                    ))}
                  </select>
                </td>
                <td className="cell-input">
                  <input 
                    type="number" 
                    value={task.man_hours} 
                    onChange={(e) => handleChange(task.id, "man_hours", e.target.value)}
                  />
                </td>
                <td className="cell-input">
                  <input 
                    type="date" 
                    value={task.start_date} 
                    onChange={(e) => handleChange(task.id, "start_date", e.target.value)}
                  />
                </td>
                <td className="cell-input">
                  <input 
                    type="date" 
                    value={task.due_date} 
                    onChange={(e) => handleChange(task.id, "due_date", e.target.value)}
                  />
                </td>
                <td className="cell-input">
                  <input 
                    type="date" 
                    value={task.end_date} 
                    onChange={(e) => handleChange(task.id, "end_date", e.target.value)}
                  />
                </td>
                <td className="cell-input">
                  <select 
                    value={task.status} 
                    onChange={(e) => handleChange(task.id, "status", e.target.value)}
                    className={`status-select ${task.status.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                    <option value="Review">Review</option>
                  </select>
                </td>
                <td className="cell-input">
                  <input 
                    type="number" 
                    value={task.days_taken} 
                    onChange={(e) => handleChange(task.id, "days_taken", e.target.value)}
                  />
                </td>
                <td className="cell-input">
                  <input 
                    type="text" 
                    value={task.depends_on} 
                    onChange={(e) => handleChange(task.id, "depends_on", e.target.value)}
                  />
                </td>
                <td className="cell-input">
                  <input 
                    type="text" 
                    value={task.link} 
                    onChange={(e) => handleChange(task.id, "link", e.target.value)}
                    placeholder="https://..."
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
