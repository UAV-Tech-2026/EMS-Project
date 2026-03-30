import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import "../styles/TaskManagement.css";

export default function TaskManagement() {
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [userRole, setUserRole] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [newTask, setNewTask] = useState({
    title: "",
    assigned_to: "",
    status: "Pending",
    due_date: "",
    man_hours: ""
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // ✅ Get user safely
  const userObj = JSON.parse(localStorage.getItem("user")) || {};

  useEffect(() => {
    if (userObj?.role) setUserRole(userObj.role);
    fetchTasks();
    fetchEmployees();
  }, []);

  // ✅ FIXED: Proper dashboard navigation
  const goToDashboard = () => {
    if (userObj.role === "super_admin") {
      navigate("/super-admin-dashboard", { replace: true });
    } else if (userObj.role === "admin") {
      navigate("/admin-dashboard", { replace: true });
    } else {
      navigate("/employee-dashboard", { replace: true });
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await api.get("/tasks/list");

      const isLead = userObj.designation?.toLowerCase().includes("lead");
      const editAccess =
        userObj.role === "admin" ||
        userObj.role === "super_admin" ||
        isLead;

      if (editAccess) {
        setTasks(res.data);
      } else {
        const myTasks = res.data.filter(
          (t) => t.assigned_to_name === userObj.fullname
        );
        setTasks(myTasks);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to fetch tasks.");
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get("/employees/list");
      setEmployees(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!newTask.title || !newTask.assigned_to) {
      setError("Title and Assignee are required.");
      return;
    }

    try {
      setError("");
      setMessage("");
      await api.post("/tasks/assign", newTask);
      fetchTasks();

      setNewTask({
        title: "",
        assigned_to: "",
        status: "Pending",
        due_date: "",
        man_hours: ""
      });

      setMessage("Task assigned successfully.");
    } catch {
      setError("Failed to assign task.");
    }
  };

  const handleEditClick = (task) => {
    setEditingId(task.id);
    setEditForm({
      ...task,
      assigned_to:
        employees.find((e) => e.fullname === task.assigned_to_name)?.id || ""
    });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleSave = async (id) => {
    try {
      await api.put(`/tasks/edit/${id}`, editForm);
      setEditingId(null);
      fetchTasks();
      setMessage("Task updated successfully.");
    } catch {
      setError("Failed to update task.");
    }
  };

  const isLead = userObj.designation?.toLowerCase().includes("lead");
  const canEdit =
    userRole === "admin" || userRole === "super_admin" || isLead;

  return (
    <div className="task-page-wrapper">
      <div
        className="task-container"
        style={{ maxWidth: "1200px", margin: "2rem auto" }}
      >
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h2>Task Management</h2>

          {/* ✅ FIXED BUTTON */}
          <button
            className="back-btn"
            onClick={goToDashboard}
            style={{ padding: "8px 16px", cursor: "pointer" }}
          >
            ← Back to Dashboard
          </button>
        </div>

        {error && <div style={{ color: "red" }}>{error}</div>}
        {message && <div style={{ color: "green" }}>{message}</div>}

        {/* ASSIGN TASK */}
        {canEdit && (
          <form onSubmit={handleAssign}>
            <input
              placeholder="Task title"
              value={newTask.title}
              onChange={(e) =>
                setNewTask({ ...newTask, title: e.target.value })
              }
            />

            <select
              value={newTask.assigned_to}
              onChange={(e) =>
                setNewTask({ ...newTask, assigned_to: e.target.value })
              }
            >
              <option value="">Select Employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullname}
                </option>
              ))}
            </select>

            <button type="submit">Assign</button>
          </form>
        )}

        {/* TASK TABLE */}
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Task</th>
              <th>Assignee</th>
              <th>Status</th>
              {canEdit && <th>Actions</th>}
            </tr>
          </thead>

          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>{task.id}</td>

                {editingId === task.id ? (
                  <>
                    <td>
                      <input
                        name="title"
                        value={editForm.title}
                        onChange={handleEditChange}
                      />
                    </td>

                    <td>
                      <select
                        name="assigned_to"
                        value={editForm.assigned_to}
                        onChange={handleEditChange}
                      >
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.fullname}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <select
                        name="status"
                        value={editForm.status}
                        onChange={handleEditChange}
                      >
                        <option>Pending</option>
                        <option>In Progress</option>
                        <option>Completed</option>
                      </select>
                    </td>

                    <td>
                      <button onClick={() => handleSave(task.id)}>
                        Save
                      </button>
                      <button onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{task.title}</td>
                    <td>{task.assigned_to_name}</td>
                    <td>{task.status}</td>

                    {canEdit && (
                      <td>
                        <button onClick={() => handleEditClick(task)}>
                          Edit
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
    </div>
  );
}