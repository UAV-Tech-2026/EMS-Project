import React, { useState } from "react";
import axios from "axios";
import { Download, Calendar } from "lucide-react";

export default function AttendanceReports() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const firstOfMonth = todayStr.slice(0, 7) + "-01";
  
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(todayStr);
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem("token");
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/attendance/export-excel?from=${fromDate}&to=${toDate}`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: "blob" }
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_${fromDate}_to_${toDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const setShortcut = (type) => {
    const now = new Date();
    if (type === "this_month") {
      setFromDate(now.toISOString().slice(0, 7) + "-01");
      setToDate(now.toISOString().split("T")[0]);
    } else if (type === "last_month") {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lme = new Date(now.getFullYear(), now.getMonth(), 0);
      setFromDate(lm.toISOString().split("T")[0]);
      setToDate(lme.toISOString().split("T")[0]);
    } else if (type === "last_7") {
      const d = new Date(); d.setDate(d.getDate() - 6);
      setFromDate(d.toISOString().split("T")[0]);
      setToDate(now.toISOString().split("T")[0]);
    }
  };

  return (
    <div className="reports-container" style={{ padding: "10px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: "700" }}>Export Attendance Data</h3>
        <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>Select a date range to generate an Excel report.</p>
      </div>

      <div style={{ display: "flex", gap: "20px", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>From Date</label>
          <input 
            type="date" 
            value={fromDate} 
            onChange={e => setFromDate(e.target.value)}
            style={{ padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none", fontSize: "14px" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>To Date</label>
          <input 
            type="date" 
            value={toDate} 
            onChange={e => setToDate(e.target.value)}
            style={{ padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none", fontSize: "14px" }}
          />
        </div>
        <button 
          onClick={handleDownload}
          disabled={loading || !fromDate || !toDate}
          style={{ 
            padding: "10px 24px", borderRadius: "8px", border: "none", 
            background: "#6366f1", color: "#fff", fontWeight: "700", 
            cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
            opacity: (loading || !fromDate || !toDate) ? 0.6 : 1,
            height: "42px"
          }}
        >
          <Download size={18} /> {loading ? "Generating..." : "Download Excel"}
        </button>
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button onClick={() => setShortcut("this_month")} style={shortcutStyle}>This Month</button>
        <button onClick={() => setShortcut("last_month")} style={shortcutStyle}>Last Month</button>
        <button onClick={() => setShortcut("last_7")} style={shortcutStyle}>Last 7 Days</button>
      </div>

      <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
        <h4 style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: "700", color: "#475569" }}>The report includes:</h4>
        <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "12px", color: "#64748b", lineHeight: "1.8" }}>
          <li>Monthly Summary of present/absent days</li>
          <li>Detailed daily logs with clock-in/out times</li>
          <li>Total hours worked per employee</li>
          <li>Leave breakdown and LOP counts</li>
        </ul>
      </div>
    </div>
  );
}

const shortcutStyle = {
  padding: "6px 12px",
  borderRadius: "6px",
  border: "1px solid #e2e8f0",
  background: "#fff",
  fontSize: "12px",
  fontWeight: "600",
  color: "#64748b",
  cursor: "pointer"
};
