import React, { useState, useEffect } from "react";
import { api } from "../utils/api";

const STATUS_STYLES = {
  Present:      { bg: "#dcfce7", color: "#16a34a", border: "#bbf7d0" },
  "0.5":        { bg: "#fef9c3", color: "#a16207", border: "#fde68a" },
  "Field Work": { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe" },
  CCL:          { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe" },
  CL:           { bg: "#ede9fe", color: "#7c3aed", border: "#ddd6fe" },
  SL:           { bg: "#ede9fe", color: "#7c3aed", border: "#ddd6fe" },
  Absent:       { bg: "#fee2e2", color: "#dc2626", border: "#fecaca" },
  LOP:          { bg: "#fee2e2", color: "#dc2626", border: "#fecaca" },
};

export default function AttendanceRecords() {
  const [records,    setRecords]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const today        = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 7) + "-01";
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate,   setToDate]   = useState(today);

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
    const matchSearch = !search ||
      r.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.employee_code?.toLowerCase().includes(search.toLowerCase());
    const matchDate = !dateFilter || r.date?.startsWith(dateFilter);
    return matchSearch && matchDate;
  });

  const presentCount = filtered.filter(r => r.status === "Present").length;
  const absentCount  = filtered.filter(r => r.status === "Absent").length;
  const leaveCount   = filtered.filter(r => ["CL","SL","CCL","LOP"].includes(r.status)).length;

  const inputStyle = {
    padding: "8px 12px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    color: "#1e293b",
    fontSize: "13px",
    fontFamily: "'DM Sans', sans-serif",
    outline: "none",
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: "#1e293b", padding: "0" }}>

      {/* Header */}
      <div style={{ marginBottom: "1rem" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
          Attendance Records
        </h3>
      </div>

      {/* Summary pills */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "1rem", flexWrap: "wrap" }}>
        {[
          { label: "Total Records", value: filtered.length, color: "#2563eb",  bg: "#eff6ff", border: "#bfdbfe" },
          { label: "Present",       value: presentCount,    color: "#16a34a",  bg: "#f0fdf4", border: "#bbf7d0" },
          { label: "Absent",        value: absentCount,     color: "#dc2626",  bg: "#fff1f2", border: "#fecaca" },
          { label: "On Leave",      value: leaveCount,      color: "#7c3aed",  bg: "#faf5ff", border: "#ddd6fe" },
        ].map(s => (
          <div key={s.label} style={{
            background: s.bg,
            border: `1px solid ${s.border}`,
            borderRadius: "8px",
            padding: "8px 16px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "18px", fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "1rem", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search by name or UAV ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: "180px" }}
        />
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          style={inputStyle}
        />
        {dateFilter && (
          <button
            onClick={() => setDateFilter("")}
            style={{
              padding: "8px 12px",
              background: "#f1f5f9",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              color: "#64748b",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        )}
        <button
          onClick={fetchRecords}
          style={{
            padding: "8px 16px",
            background: "#2563eb",
            border: "none",
            borderRadius: "8px",
            color: "#ffffff",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
          Loading records...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
          No attendance records found.
        </div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {["UAV ID", "Name", "Date", "Status", "In Time", "Out Time", "Hours", "Marked By"].map(h => (
                  <th key={h} style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const sc = STATUS_STYLES[r.status] || { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0" };
                return (
                  <tr key={r.id || i} style={{
                    borderBottom: "1px solid #f1f5f9",
                    background: i % 2 === 0 ? "#ffffff" : "#f8fafc",
                  }}>
                    <td style={{ padding: "10px 12px", color: "#2563eb", fontWeight: 600 }}>
                      {r.employee_code || "—"}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#1e293b" }}>
                      {r.name || "—"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#64748b" }}>
                      {r.date ? new Date(r.date).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric"
                      }) : "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        background: sc.bg,
                        color: sc.color,
                        border: `1px solid ${sc.border}`,
                        borderRadius: "6px",
                        padding: "3px 10px",
                        fontSize: "11px",
                        fontWeight: 600,
                      }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#64748b" }}>
                      {r.check_in || "—"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#64748b" }}>
                      {r.check_out || "—"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#16a34a", fontWeight: 600 }}>
                      {r.hours_worked || "—"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: "12px" }}>
                      {r.marked_by_name || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
