import React, { useState, useEffect } from "react";
import {
  Search,
  RotateCw,
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  Plane,
  Filter,
  ArrowRight
} from "lucide-react";
import { api } from "../utils/api";
import "../styles/AttendanceRecords.css";

const STATUS_STYLES = {
  Present: { bg: "#dcfce7", color: "#16a34a", border: "#bbf7d0" },
  "0.5": { bg: "#fef9c3", color: "#a16207", border: "#fde68a" },
  "Field Work": { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe" },
  CCL: { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe" },
  CL: { bg: "#ede9fe", color: "#7c3aed", border: "#ddd6fe" },
  SL: { bg: "#ede9fe", color: "#7c3aed", border: "#ddd6fe" },
  Absent: { bg: "#fee2e2", color: "#dc2626", border: "#fecaca" },
  LOP: { bg: "#fee2e2", color: "#dc2626", border: "#fecaca" },
};

const formatTimeAMPM = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string") return "—";
  if (timeStr.includes("AM") || timeStr.includes("PM")) return timeStr;
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${parts[1]} ${ampm}`;
};

export default function AttendanceRecords() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const firstOfMonth = todayStr.slice(0, 7) + "-01";
  const minDate = new Date(new Date().setFullYear(today.getFullYear() - 2)).toISOString().split("T")[0];
  const maxDate = new Date(new Date().setFullYear(today.getFullYear() + 2)).toISOString().split("T")[0];

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(todayStr);

  useEffect(() => { fetchRecords(); }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await api.get("/attendance/");
      setRecords(res.data);
    } catch (err) {
      console.error("Failed to fetch attendance records:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = records.filter(r => {
    const matchSearch =
      !search ||
      r.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.employee_code?.toLowerCase().includes(search.toLowerCase());
    
    // Normalize r.date (which might be an ISO string) to YYYY-MM-DD
    const rDate = r.date ? new Date(r.date).toISOString().split('T')[0] : "";
    const matchFrom = !fromDate || rDate >= fromDate;
    const matchTo = !toDate || rDate <= toDate;
    
    return matchSearch && matchFrom && matchTo;
  });

  const total = filtered.length;
  const presentCount = filtered.filter(r => r.status === "Present" || r.status === "0.5").length;
  const absentCount = filtered.filter(r => r.status === "Absent").length;
  const leaveCount = filtered.filter(r => ["CL", "SL", "CCL", "LOP", "Field Work"].includes(r.status)).length;

  const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0;

  const statCards = [
    { label: "Total Records", value: total, cls: "ar-stat-card--blue", icon: <Users size={24} />, fill: 100 },
    { label: "Present Today", value: presentCount, cls: "ar-stat-card--green", icon: <CheckCircle2 size={24} />, fill: pct(presentCount) },
    { label: "Absent Today", value: absentCount, cls: "ar-stat-card--red", icon: <XCircle size={24} />, fill: pct(absentCount) },
    { label: "On Leave", value: leaveCount, cls: "ar-stat-card--purple", icon: <Plane size={24} />, fill: pct(leaveCount) },
  ];

  return (
    <div className="ar-wrapper">
      <div className="ar-header">
        <div className="ar-header-content">
          <h3 className="ar-title">Attendance Records</h3>
          <p className="ar-subtitle">Insights and logs for employee presence</p>
        </div>
      </div>

      <div className="ar-stats-grid">
        {statCards.map(card => (
          <div key={card.label} className={`ar-stat-card ${card.cls}`}>
            <div className="ar-stat-card-inner">
              <div className="ar-stat-icon-box">{card.icon}</div>
              <div className="ar-stat-info">
                <div className="ar-stat-value">{card.value}</div>
                <div className="ar-stat-label">{card.label}</div>
              </div>
            </div>
            <div className="ar-stat-progress">
              <div className="ar-stat-progress-bar" style={{ width: `${card.fill}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="ar-filters-container">
        <div className="ar-search-group">
          <div className="ar-input-icon-wrap">
            <Search className="ar-input-icon" size={16} />
            <input
              className="ar-search-input"
              type="text"
              placeholder="Search by name or UAV ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="ar-date-range-group">
          <div className="ar-date-field">
            <label>From</label>
            <input
              type="date"
              value={fromDate}
              min={minDate}
              max={toDate || maxDate}
              onChange={e => setFromDate(e.target.value)}
            />
          </div>
          <ArrowRight className="ar-range-arrow" size={14} />
          <div className="ar-date-field">
            <label>To</label>
            <input
              type="date"
              value={toDate}
              min={fromDate || minDate}
              max={maxDate}
              onChange={e => setToDate(e.target.value)}
            />
          </div>
        </div>

        <div className="ar-actions-group">
          <button
            className="ar-btn-secondary"
            onClick={() => { setFromDate(firstOfMonth); setToDate(todayStr); setSearch(""); }}
          >
            Reset
          </button>
          <button className="ar-btn-primary" onClick={fetchRecords}>
            <RotateCw size={14} className={loading ? "ar-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="ar-loading-state">
          <div className="ar-loader" />
          <p>Syncing attendance data...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="ar-empty-state">
          <div className="ar-empty-icon-box">
            <Filter size={32} />
          </div>
          <h4>No results found</h4>
          <p>We couldn't find any records matching your filters.</p>
          <button className="ar-btn-link" onClick={() => setSearch("")}>Clear Search</button>
        </div>
      ) : (
        <div className="ar-content-area">
          <div className="ar-table-meta">
            <div className="ar-count-badge">
              <span>{filtered.length}</span> Records Found
            </div>
          </div>

          <div className="ar-table-container">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>UAV ID</th>
                  <th>Employee Name</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Work Hours</th>
                  <th>Marked By</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const sc = STATUS_STYLES[r.status] || { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0" };
                  return (
                    <tr key={r.id || i}>
                      <td><span className="ar-emp-code">{r.employee_code || "—"}</span></td>
                      <td className="ar-emp-name">{r.name || "—"}</td>
                      <td className="ar-date-cell">
                        <Calendar size={12} />
                        {r.date
                          ? new Date(r.date).toLocaleDateString("en-IN", {
                            day: "2-digit", month: "short", year: "numeric",
                          })
                          : "—"}
                      </td>
                      <td>
                        <span className="ar-status-badge"
                          style={{ backgroundColor: sc.bg, color: sc.color, borderColor: sc.border }}>
                          {r.status}
                        </span>
                      </td>
                      <td className="ar-time-cell">{formatTimeAMPM(r.check_in)}</td>
                      <td className="ar-time-cell">{formatTimeAMPM(r.check_out)}</td>
                      <td className="ar-hours-cell">{r.hours_worked || "—"}</td>
                      <td className="ar-marked-by">{r.marked_by_name || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}