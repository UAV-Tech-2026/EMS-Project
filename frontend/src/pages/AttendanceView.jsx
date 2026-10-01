import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";

export default function AttendanceView() {
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ present: 0, absent: 0, leaves: 0, total: 0 });

  // Default to September 2026 (or last month to current date)
  const [from, setFrom] = useState("2026-09-01");
  const [to, setTo] = useState("2026-09-30");

  const fetchAttendance = useCallback(async (overrideFrom, overrideTo) => {
    setLoading(true);
    try {
      const queryFrom = overrideFrom !== undefined ? overrideFrom : from;
      const queryTo = overrideTo !== undefined ? overrideTo : to;

      const res = await api.get("/attendance/my", {
        params: { from: queryFrom, to: queryTo }
      });
      const data = Array.isArray(res.data) ? res.data : [];
      setAttendance(data);

      let present = 0, absent = 0, leaves = 0;
      data.forEach(r => {
        const s = (r.status || "").toLowerCase();
        if (s === "present") present++;
        else if (s === "absent") absent++;
        else if (["cl", "ml", "sl", "ccl", "lop", "pl", "half day", "leave"].some(x => s.includes(x))) leaves++;
      });
      setSummary({ present, absent, leaves, total: data.length });
    } catch (err) {
      console.error("Failed to fetch attendance:", err);
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchAttendance("2026-09-01", "2026-09-30");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setMonthRange = (start, end) => {
    setFrom(start);
    setTo(end);
    fetchAttendance(start, end);
  };

  const getStatusStyle = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "present") return { background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0" };
    if (s === "absent") return { background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" };
    if (s === "cl" || s.includes("casual")) return { background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a" };
    if (["ml", "sl"].some(x => s.includes(x)) || s.includes("medical") || s.includes("sick")) return { background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd" };
    if (s.includes("lop") || s.includes("loss")) return { background: "#fce7f3", color: "#be185d", border: "1px solid #fbcfe8" };
    if (s.includes("half")) return { background: "#f3e8ff", color: "#7c3aed", border: "1px solid #e9d5ff" };
    if (s.includes("off") || s.includes("holiday")) return { background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" };
    return { background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" };
  };

  const displayDate = (dateStr) => {
    if (!dateStr) return "–";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return dateStr; }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'DM Sans','Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#1e293b 0%,#334155 100%)", padding: "14px 24px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 2px 10px rgba(0,0,0,.1)" }}>
        <img src={import.meta.env.VITE_LOGO_URL || "/logo.jpg"} alt="Logo" style={{ width: 36, height: 36, borderRadius: 8, background: "#fff", objectFit: "contain", padding: 3 }} onError={e => { e.target.style.display = "none"; }} />
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff" }}>Attendance History</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>Employee attendance records & monthly logs</p>
        </div>
        <button onClick={() => {
          const role = JSON.parse(sessionStorage.getItem("user") || "{}").role;
          if (role === "super_admin") navigate("/super-admin-dashboard");
          else if (role === "admin") navigate("/admin-dashboard");
          else navigate("/employee-dashboard");
        }} style={{ marginLeft: "auto", background: "rgba(255,255,255,.1)", color: "#fff", border: "1px solid rgba(255,255,255,.2)", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
          ← Back to Dashboard
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 16px" }}>

        {/* Quick Month Filter Buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Quick Range:</span>
          <button onClick={() => setMonthRange("2026-09-01", "2026-09-30")} style={{ padding: "4px 12px", background: from === "2026-09-01" && to === "2026-09-30" ? "#2563eb" : "#e2e8f0", color: from === "2026-09-01" && to === "2026-09-30" ? "#fff" : "#334155", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            September 2026 (Full Month)
          </button>
          <button onClick={() => setMonthRange("2026-10-01", "2026-10-31")} style={{ padding: "4px 12px", background: from === "2026-10-01" ? "#2563eb" : "#e2e8f0", color: from === "2026-10-01" ? "#fff" : "#334155", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            October 2026
          </button>
          <button onClick={() => setMonthRange("2026-01-01", "2026-12-31")} style={{ padding: "4px 12px", background: from === "2026-01-01" ? "#2563eb" : "#e2e8f0", color: from === "2026-01-01" ? "#fff" : "#334155", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            All 2026
          </button>
        </div>

        {/* Compact Summary Row */}
        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
            {[
              { label: "Total Days", value: summary.total, bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
              { label: "Present", value: summary.present, bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
              { label: "Absent", value: summary.absent, bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
              { label: "Leaves", value: summary.leaves, bg: "#fefce8", color: "#a16207", border: "#fde68a" },
            ].map((card, i) => (
              <div key={i} style={{ background: card.bg, border: `1px solid ${card.border}`, borderRadius: 8, padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: card.color }}>{card.label}</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: card.color }}>{card.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Compact Date Filter Bar */}
        <div style={{ background: "#fff", borderRadius: 10, padding: "12px 18px", marginBottom: 14, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,.03)", display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em" }}>From Date</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em" }}>To Date</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
          </div>
          <button onClick={() => fetchAttendance()} style={{ padding: "7px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Apply Filters
          </button>
          <button onClick={() => setMonthRange("2026-09-01", "2026-09-30")} style={{ padding: "7px 14px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
            Reset (Sept 2026)
          </button>
        </div>

        {/* High-Density Table View */}
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,.03)", overflow: "hidden" }}>
          <div style={{ padding: "10px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>Attendance Records</span>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{attendance.length} record{attendance.length !== 1 ? "s" : ""} found</span>
          </div>

          {loading ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#64748b", fontSize: 13, fontWeight: 600 }}>Loading attendance records...</div>
          ) : attendance.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#64748b", fontSize: 13 }}>No attendance records found for selected period</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    {["#", "Date", "Check In", "Check Out", "Hours Worked", "Status"].map((h, i) => (
                      <th key={i} style={{ padding: "8px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: ".05em", borderBottom: "1px solid #cbd5e1", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((record, index) => (
                    <tr key={index} style={{ borderBottom: "1px solid #f1f5f9", transition: "background .1s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "8px 16px", color: "#94a3b8", fontWeight: 500 }}>{index + 1}</td>
                      <td style={{ padding: "8px 16px", fontWeight: 700, color: "#1e293b" }}>{displayDate(record.date || record.attendance_date)}</td>
                      <td style={{ padding: "8px 16px", color: record.check_in ? "#15803d" : "#94a3b8", fontWeight: 500 }}>{record.check_in || "–"}</td>
                      <td style={{ padding: "8px 16px", color: record.check_out ? "#b91c1c" : "#94a3b8", fontWeight: 500 }}>{record.check_out || "–"}</td>
                      <td style={{ padding: "8px 16px", color: "#475569", fontWeight: 500 }}>{record.hours_worked || "–"}</td>
                      <td style={{ padding: "8px 16px" }}>
                        <span style={{ ...getStatusStyle(record.status), padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, display: "inline-block", whiteSpace: "nowrap" }}>
                          {record.status || "Unknown"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
