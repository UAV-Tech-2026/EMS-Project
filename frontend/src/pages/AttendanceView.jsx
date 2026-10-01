import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";

export default function AttendanceView() {
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ present: 0, absent: 0, leaves: 0, total: 0 });

  const today = new Date();
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(today.getMonth() - 6);

  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const [from, setFrom] = useState(fmt(sixMonthsAgo));
  const [to, setTo] = useState(fmt(today));

  const fetchAttendance = useCallback(async (overrideFrom, overrideTo) => {
    setLoading(true);
    try {
      const res = await api.get("/attendance/my", {
        params: { from: overrideFrom || from, to: overrideTo || to }
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
    fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleReset = () => {
    const f = fmt(sixMonthsAgo);
    const t = fmt(today);
    setFrom(f);
    setTo(t);
    fetchAttendance(f, t);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'DM Sans','Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#1e293b 0%,#334155 100%)", padding: "20px 32px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 4px 16px rgba(0,0,0,.15)" }}>
        <img src={import.meta.env.VITE_LOGO_URL || "/logo.jpg"} alt="Logo" style={{ width: 44, height: 44, borderRadius: 10, background: "#fff", objectFit: "contain", padding: 4 }} onError={e => { e.target.style.display = "none"; }} />
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#fff" }}>Attendance History</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>Your personal attendance records</p>
        </div>
        <button onClick={() => {
          const role = JSON.parse(sessionStorage.getItem("user") || "{}").role;
          if (role === "super_admin") navigate("/super-admin-dashboard");
          else if (role === "admin") navigate("/admin-dashboard");
          else navigate("/employee-dashboard");
        }} style={{ marginLeft: "auto", background: "rgba(255,255,255,.1)", color: "#fff", border: "1px solid rgba(255,255,255,.2)", padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          ← Back to Dashboard
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        {/* Summary Cards */}
        {!loading && attendance.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 16, marginBottom: 24 }}>
            {[
              { label: "Total Days", value: summary.total, bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", emoji: "📅" },
              { label: "Present", value: summary.present, bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", emoji: "✅" },
              { label: "Absent", value: summary.absent, bg: "#fef2f2", color: "#b91c1c", border: "#fecaca", emoji: "❌" },
              { label: "Leaves", value: summary.leaves, bg: "#fefce8", color: "#a16207", border: "#fde68a", emoji: "🌴" },
            ].map((card, i) => (
              <div key={i} style={{ background: card.bg, border: `1px solid ${card.border}`, borderRadius: 14, padding: "16px 20px", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,.04)" }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{card.emoji}</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: card.color }}>{card.value}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: card.color, marginTop: 4 }}>{card.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filter Bar */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", marginBottom: 20, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,.04)", display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em" }}>From Date</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em" }}>To Date</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
          </div>
          <button onClick={() => fetchAttendance()} style={{ padding: "10px 28px", background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 2px 8px rgba(59,130,246,.3)" }}>
            Apply Filters
          </button>
          <button onClick={handleReset} style={{ padding: "10px 18px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            Reset
          </button>
        </div>

        {/* Table */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 4px 16px rgba(0,0,0,.05)", overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>📋 Attendance Records</span>
            <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>{attendance.length} record{attendance.length !== 1 ? "s" : ""} found</span>
          </div>

          {loading ? (
            <div style={{ padding: "60px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
              <div style={{ color: "#64748b", fontWeight: 600, fontSize: 15 }}>Loading attendance records...</div>
            </div>
          ) : attendance.length === 0 ? (
            <div style={{ padding: "60px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>📭</div>
              <div style={{ color: "#1e293b", fontWeight: 700, fontSize: 16 }}>No attendance records found</div>
              <div style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>Try adjusting the date range or ask your admin to upload attendance data</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["#", "Date", "Check In", "Check Out", "Hours Worked", "Status"].map((h, i) => (
                      <th key={i} style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((record, index) => (
                    <tr key={index} style={{ borderBottom: "1px solid #f1f5f9", transition: "background .15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#fafbff"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "13px 20px", color: "#94a3b8", fontWeight: 500 }}>{index + 1}</td>
                      <td style={{ padding: "13px 20px", fontWeight: 700, color: "#1e293b" }}>{displayDate(record.date || record.attendance_date)}</td>
                      <td style={{ padding: "13px 20px", color: record.check_in ? "#15803d" : "#cbd5e1", fontWeight: 600 }}>{record.check_in || "–"}</td>
                      <td style={{ padding: "13px 20px", color: record.check_out ? "#b91c1c" : "#cbd5e1", fontWeight: 600 }}>{record.check_out || "–"}</td>
                      <td style={{ padding: "13px 20px", color: "#475569", fontWeight: 500 }}>{record.hours_worked || "–"}</td>
                      <td style={{ padding: "13px 20px" }}>
                        <span style={{ ...getStatusStyle(record.status), padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, display: "inline-block", whiteSpace: "nowrap" }}>
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
