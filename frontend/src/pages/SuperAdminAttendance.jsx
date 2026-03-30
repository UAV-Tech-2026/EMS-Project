import React, { useState, useEffect } from "react";
import { api } from "../utils/api";
import "../styles/SuperAdminAttendance.css";

export default function SuperAdminAttendance() {
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [file, setFile] = useState(null);

  const fetchData = async () => {
    try {
      const empRes = await api.get("/attendance/employees-list");
      const attRes = await api.get("/attendance");
      setEmployees(empRes.data);
      setAttendance(attRes.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleManual = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    
    const payload = {
      user_id: formData.get("employee"),
      attendance_date: formData.get("date"), 
      check_in: formData.get("check_in") || null,
      check_out: formData.get("check_out") || null,
      status: formData.get("status"),
    };

    try {
      const res = await api.post("/attendance/manual", payload);
      if (res.status === 201 || res.status === 200) {
        alert("Attendance Logged/Updated in Database!");
        fetchData();
        e.target.reset();
      }
    } catch (err) {
      console.error("Log Entry Failed:", err.response?.data);
      alert("Error: " + (err.response?.data?.msg || "Check your backend console"));
    }
  };

 
  const handleExport = async () => {
    try {
      const response = await api.get("/attendance/export-excel", { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Attendance_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      alert("Export failed");
    }
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a file first");
    const formData = new FormData();
    formData.append("file", file);
    try {
      await api.post("/attendance/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setFile(null);
      fetchData();
      alert("Bulk Sync Complete");
    } catch (err) {
      alert("Upload failed");
    }
  };

  return (
    <div className="attendance-container">
      <div className="header-flex">
        <h2>Attendance Intelligence (pgAdmin Storage)</h2>
        <button onClick={handleExport} className="export-btn" style={{ backgroundColor: '#16a34a', color: 'white', padding: '10px', borderRadius: '5px', cursor: 'pointer' }}>
          Download Excel Report
        </button>
      </div>

      <form onSubmit={handleManual} className="attendance-form">
        <div className="input-group">
          <div className="input-field">
            <label>Employee</label>
            <select name="employee" required>
              <option value="">Select Employee</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  
                  {emp.employee_uav_id} - {emp.fullname}
                </option>
              ))}
            </select>
          </div>

          <div className="input-field">
            <label>Date</label>
            <input type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} required />
          </div>
        </div>

        <div className="input-group">
          <div className="input-field">
            <label>Check-In (Morning)</label>
            <input type="time" name="check_in" />
          </div>
          <div className="input-field">
            <label>Check-Out (Evening)</label>
            <input type="time" name="check_out" />
          </div>
          <div className="input-field">
            <label>Status</label>
            <select name="status">
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Leave">Leave</option>
              <option value="Field Work">Field Work</option>
            </select>
          </div>
        </div>

        <button type="submit" className="log-btn">Post to Database</button>
      </form>

      <div className="upload-section" style={{ marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '20px' }}>
        <p><strong>Bulk Import (CSV/Excel):</strong></p>
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        <button onClick={handleUpload}>Sync Data</button>
      </div>

      <div className="table-wrapper">
        <h3>Live Attendance Logs</h3>
        <table>
          <thead>
            <tr>
              <th>Employee Code</th>
              <th>Name</th>
              <th>Date</th>
              <th>Check-In</th>
              <th>Check-Out</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {attendance.length > 0 ? attendance.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.employee_code}</strong></td>
                <td>{a.name}</td>
                <td>{new Date(a.date).toLocaleDateString('en-GB')}</td>
                <td>{a.check_in || "--:--"}</td>
                <td>{a.check_out || "--:--"}</td>
                <td>
                  <span className={`status-badge status-${a.status?.toLowerCase()}`}>
                    {a.status}
                  </span>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="6">No attendance records found in pgAdmin.</td></tr>
            )}
          </tbody>
        </table>
        <br />
        <button className="logout-link-btn" onClick={() => window.location.href='/super-admin-dashboard'}>
            Back to Dashboard
        </button>
      </div>
    </div>
  );
}