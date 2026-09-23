import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import "../styles/AttendanceView.css";
import "../styles/EmployeeDashboard.css";

export default function AttendanceView() {
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const minDate = new Date(new Date().setFullYear(today.getFullYear() - 2)).toISOString().split("T")[0];
  const maxDate = new Date(new Date().setFullYear(today.getFullYear() + 2)).toISOString().split("T")[0];
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

  const [viewMode, setViewMode] = useState("table"); // "table" | "viewer"
  const [selectedPreview, setSelectedPreview] = useState(null); // { type, name, url }

  const handlePreviewUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    const url = URL.createObjectURL(file);
    setSelectedPreview({ type: ext === "pdf" ? "pdf" : "excel", name: file.name, url, file });
  };

  return (
    <div className="attendance-view-container">
      <header className="attendance-view-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{
              width: 42, height: 42,
              background: "#ffffff",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
            }}>
              <img
                src={import.meta.env.VITE_LOGO_URL || "/logo.jpg"}
                alt="Logo"
                style={{ width: 36, height: 36, objectFit: "contain" }}
                onError={(e) => {
                  if (e.target.src !== window.location.origin + "/logo.jpg") {
                    e.target.src = "/logo.jpg";
                  } else {
                    e.target.style.display = 'none';
                  }
                }}
              />
            </div>
            <h1 className="attendance-view-title" style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>
              Attendance History & Reports
            </h1>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setViewMode("table")}
              style={{
                padding: "8px 16px", borderRadius: "8px", fontWeight: 700, fontSize: "13px",
                border: "1px solid #cbd5e1", cursor: "pointer",
                background: viewMode === "table" ? "#1e293b" : "#fff",
                color: viewMode === "table" ? "#fff" : "#475569"
              }}
            >
              📅 Records Table
            </button>
            <button
              onClick={() => setViewMode("viewer")}
              style={{
                padding: "8px 16px", borderRadius: "8px", fontWeight: 700, fontSize: "13px",
                border: "1px solid #cbd5e1", cursor: "pointer",
                background: viewMode === "viewer" ? "#1F4E79" : "#fff",
                color: viewMode === "viewer" ? "#fff" : "#475569"
              }}
            >
              📄 Live PDF & Excel Viewer
            </button>
          </div>
        </div>
      </header>

      {viewMode === "table" ? (
        <>
          <div className="attendance-filters">
            <div className="filter-group">
              <label>From Date</label>
              <input type="date" name="from" value={filters.from} min={minDate} max={maxDate} onChange={handleFilterChange} />
            </div>
            <div className="filter-group">
              <label>To Date</label>
              <input type="date" name="to" value={filters.to} min={minDate} max={maxDate} onChange={handleFilterChange} />
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
        </>
      ) : (
        <div style={{ background: "#ffffff", padding: "24px", borderRadius: "16px", border: "1px solid #e2e8f0", marginTop: "20px" }}>
          <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#1e293b" }}>
                Live On-Screen Document Viewer (PDF / Excel)
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#64748b" }}>
                Inspect uploaded attendance sheets, PDF reports, or biometric exports directly on screen without downloading.
              </p>
            </div>
            <label style={{
              background: "#1F4E79", color: "#fff", padding: "10px 18px",
              borderRadius: "10px", fontWeight: 700, fontSize: "14px",
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px"
            }}>
              📁 Open PDF / Excel to View
              <input type="file" accept=".pdf,.xlsx,.xls" onChange={handlePreviewUpload} style={{ display: "none" }} />
            </label>
          </div>

          {selectedPreview ? (
            <div style={{ border: "1px solid #cbd5e1", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: "#1e293b", fontSize: "14px" }}>
                  Currently Viewing: {selectedPreview.name}
                </span>
                <button
                  onClick={() => setSelectedPreview(null)}
                  style={{ background: "#fee2e2", color: "#991b1b", border: "none", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: 700 }}
                >
                  Close Viewer
                </button>
              </div>
              {selectedPreview.type === "pdf" ? (
                <iframe src={selectedPreview.url} title="PDF Viewer" style={{ width: "100%", height: "650px", border: "none" }} />
              ) : (
                <iframe src={selectedPreview.url} title="Excel Viewer" style={{ width: "100%", height: "650px", border: "none" }} />
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "48px 20px", border: "2px dashed #cbd5e1", borderRadius: "12px", background: "#f8fafc" }}>
              <p style={{ fontSize: "16px", color: "#475569", fontWeight: 600, margin: 0 }}>
                Select any PDF or Excel file above to preview live on screen in full width!
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Back Button ── */}
      <div style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => {
            const role = JSON.parse(sessionStorage.getItem("user"))?.role;
            if (role === "super_admin") navigate("/super-admin-dashboard");
            else if (role === "admin") navigate("/admin-dashboard");
            else navigate("/employee-dashboard");
          }}
          style={{
            background: "#fff",
            color: "#475569",
            border: "1px solid #e2e8f0",
            padding: "10px 24px",
            borderRadius: "10px",
            fontWeight: "700",
            fontSize: "14px",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          ← Back to Dashboard
        </button>
      </div>

    </div> 
  );
}
