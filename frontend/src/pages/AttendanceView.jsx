import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../utils/api";
import "../styles/AttendanceView.css";

export default function AttendanceView() {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [filters, setFilters] = useState({
    from: formatDate(firstDay),
    to: formatDate(today)
  });

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const res = await api.get("/attendance/my", { params: filters });
      setAttendance(res.data);
    } catch (err) {
      console.error("Failed to fetch attendance:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'present': return 'status-present';
      case 'absent': return 'status-absent';
      case 'half-day': case '0.5': return 'status-half-day';
      case 'cl': case 'sl': case 'ccl': return 'status-leave';
      case 'lop': return 'status-lop';
      case 'field work': return 'status-field';
      default: return '';
    }
  };

  return (
    <div className="attendance-view-container">
      <header className="attendance-view-header">
        <h1 className="attendance-view-title">My Attendance History</h1>
        <Link to="/employee-dashboard" className="filter-btn" style={{ textDecoration: 'none' }}>
           Back to Dashboard
        </Link>
      </header>

      <div className="attendance-filters">
        <div className="filter-group">
          <label>From Date</label>
          <input type="date" name="from" value={filters.from} onChange={handleFilterChange} />
        </div>
        <div className="filter-group">
          <label>To Date</label>
          <input type="date" name="to" value={filters.to} onChange={handleFilterChange} />
        </div>
        <button className="filter-btn" onClick={fetchAttendance}>Apply Filters</button>
      </div>

      <div className="attendance-table-card">
        {loading ? (
          <div className="no-data">Loading attendance records...</div>
        ) : attendance.length === 0 ? (
          <div className="no-data">No attendance records found for this period.</div>
        ) : (
          <table className="attendance-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Hours Worked</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((record, index) => (
                <tr key={index}>
                  <td>{new Date(record.date).toLocaleDateString("en-IN")}</td>
                  <td>{record.check_in || "—"}</td>
                  <td>{record.check_out || "—"}</td>
                  <td>{record.hours_worked || "—"}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(record.status)}`}>
                      {record.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
