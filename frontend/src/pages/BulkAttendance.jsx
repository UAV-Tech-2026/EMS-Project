import React, { useState, useEffect } from "react";
import { api } from "../utils/api";
import "../styles/BulkAttendance.css";


const NEEDS_TIME  = ["Present", "0.5", "Field Work","CCL"];

const TIME_FROZEN = ["CL", "SL", "Absent", "LOP"];


function calcHours(inTime, outTime) {
  if (!inTime || !outTime) return null;
  const [inH,  inM]  = inTime.split(":").map(Number);
  const [outH, outM] = outTime.split(":").map(Number);
  const totalMins = (outH * 60 + outM) - (inH * 60 + inM);
  if (totalMins <= 0) return null;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return { h, m, totalMins };
}


function hoursStyle(totalMins) {
  if (!totalMins) return {};
  if (totalMins >= 480)      return { color: "#10b981", fontWeight: 700 }; 
  if (totalMins >= 240)      return { color: "#fbbf24", fontWeight: 600 }; 
  return                            { color: "#f87171", fontWeight: 600 }; 
}

export default function BulkAttendance() {
  const [employees,     setEmployees]     = useState([]);
  const [date,          setDate]          = useState(new Date().toISOString().split("T")[0]);
  const [attendanceData,setAttendanceData]= useState({});
  const [loading,       setLoading]       = useState(true);
  const [submitted,     setSubmitted]     = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setSubmitted(false);

        const [empRes, recordRes] = await Promise.all([
          api.get("/attendance/employees-list"),
          api.get(`/attendance/today?date=${date}`)
        ]);

        const initial = {};
       empRes.data.forEach(emp => {
          const existing = recordRes.data.find(r => r.user_id === emp.id);
          
          const inTime  = existing?.check_in  || "";
          const outTime = existing?.check_out || "";

          // Clear out-time if it's invalid (before or equal to in-time)
          let safeOut = outTime;
          if (inTime && outTime) {
            const [ih, im] = inTime.split(":").map(Number);
            const [oh, om] = outTime.split(":").map(Number);
            if ((oh * 60 + om) <= (ih * 60 + im)) safeOut = "";
          }

          initial[emp.id] = {
            status: existing?.status   || "",
            in:     inTime,
            out:    safeOut             // ← use sanitised value
          };
        });

        setEmployees(empRes.data);
        setAttendanceData(initial);
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [date]);

  const handleUpdate = (id, field, value) => {
  setAttendanceData(prev => {
    const updated = { ...prev[id], [field]: value };

    if (field === "status" && TIME_FROZEN.includes(value)) {
      updated.in  = "";
      updated.out = "";
    }

    // Guard: only run if value is a valid time string
    if (field === "in" && value && updated.out) {
      const [ih, im] = value.split(":").map(Number);
      const [oh, om] = updated.out.split(":").map(Number);
      if ((oh * 60 + om) <= (ih * 60 + im)) updated.out = "";
    }

    return { ...prev, [id]: updated };
  });
};


  const missingStatus = (emp) => !attendanceData[emp.id]?.status;
  const missingInTime = (emp) => {
    const d = attendanceData[emp.id];
    return d && NEEDS_TIME.includes(d.status) && !d.in;
  };
  const getRowError = (emp) => {
    if (missingStatus(emp)) return "status";
    if (missingInTime(emp)) return "intime";
    return null;
  };

  const errorRows    = employees.filter(emp => getRowError(emp));
  const noStatusRows = employees.filter(emp => missingStatus(emp));
  const noTimeRows   = employees.filter(emp => !missingStatus(emp) && missingInTime(emp));
  const canSubmit    = errorRows.length === 0 && employees.length > 0;


  const totalHoursSummary = employees.reduce((acc, emp) => {
    const d = attendanceData[emp.id];
    if (!d) return acc;
    const result = calcHours(d.in, d.out);
    return acc + (result?.totalMins || 0);
  }, 0);
  const summaryH = Math.floor(totalHoursSummary / 60);
  const summaryM = totalHoursSummary % 60;

  const handleSync = async () => {
    setSubmitted(true);
    if (!canSubmit) {
      const lines = [];
      if (noStatusRows.length)
        lines.push(`Status not selected:\n${noStatusRows.map(e => "  • " + e.fullname).join("\n")}`);
      if (noTimeRows.length)
        lines.push(`In-Time missing (required for Present/Half Day/Field Work):\n${noTimeRows.map(e => "  • " + e.fullname).join("\n")}`);
      alert("⚠️ Please fix the following:\n\n" + lines.join("\n\n"));
      return;
    }

    const records = employees.map(emp => ({
      user_id:         emp.id,
      employee_uav_id: emp.employee_uav_id,
      status:          attendanceData[emp.id].status,
      check_in:        attendanceData[emp.id].in  || null,
      check_out:       attendanceData[emp.id].out || null
    }));

    try {
      await api.post("/attendance/bulk-log", { date, records });
      alert("✅ Attendance Synced Successfully!");
      setSubmitted(false);
    } catch (err) {
      console.error(err);
      alert("Error: " + (err.response?.data?.msg || "Save failed"));
    }
  };

  if (loading) return <div className="loading-text">Loading Records...</div>;

  return (
    <div className="bulk-container">

      
      <div className="bulk-header">
        <input
          type="date"
          value={date}
          readOnly
          style={{ cursor: "not-allowed", opacity: 0.7 }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>

          
          {totalHoursSummary > 0 && (
            <span className="badge-hours">
              🕐 Total: {summaryH}h {summaryM}m across {employees.filter(e => {
                const d = attendanceData[e.id];
                return d && calcHours(d.in, d.out);
              }).length} employees
            </span>
          )}

          {noStatusRows.length > 0 && (
            <span className="badge-error">
              ⚠️ {noStatusRows.length} status{noStatusRows.length > 1 ? "es" : ""} missing
            </span>
          )}
          {noTimeRows.length > 0 && (
            <span className="badge-warn">
              🕐 {noTimeRows.length} in-time{noTimeRows.length > 1 ? "s" : ""} missing
            </span>
          )}
          {canSubmit && (
            <span className="badge-ok">✅ Ready to submit</span>
          )}

          <button
            onClick={handleSync}
            className="save-btn"
            disabled={!canSubmit}
            style={{ opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? "pointer" : "not-allowed" }}
          >
            Sync / Post Attendance
          </button>
        </div>
      </div>

      
      <table className="bulk-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Status <span style={{ color: "#dc2626" }}>*</span></th>
            <th>In Time <span style={{ color: "#dc2626", fontSize: "10px" }}>*(Present/Half/Field)</span></th>
            <th>Out Time</th>
            <th>Total Hours</th>
          </tr>
        </thead>
        <tbody>
          {employees.map(emp => {
            const current   = attendanceData[emp.id] || { status: "", in: "", out: "" };
            const isFrozen  = TIME_FROZEN.includes(current.status);
            const needsTime = NEEDS_TIME.includes(current.status);
            const rowErr    = submitted ? getRowError(emp) : null;
            const statErr   = !current.status;
            const timeErr   = submitted && needsTime && !current.in;

            
            const hours     = calcHours(current.in, current.out);
            const hStyle    = hoursStyle(hours?.totalMins);

            
            const outBeforeIn = (() => {
              if (!current.in || !current.out) return false;
              const [ih, im] = current.in.split(":").map(Number);
              const [oh, om] = current.out.split(":").map(Number);
              return (oh * 60 + om) <= (ih * 60 + im);
            })();

            return (
              <tr
                key={emp.id}
                className={rowErr ? "bulk-row-error" : ""}
              >
                <td>{emp.employee_uav_id}</td>
                <td style={{ fontWeight: 600 }}>{emp.fullname || "Unnamed"}</td>

               
                <td>
                  <select
                    className={statErr ? "bulk-input-error" : ""}
                    value={current.status}
                    onChange={e => handleUpdate(emp.id, "status", e.target.value)}
                  >
                    <option value="">— Select Status —</option>
                    <option value="Present">✅  Present</option>
                    <option value="0.5">🌓  Half Day (0.5)</option>
                    <option value="Field Work">🚗  Field Work</option>
                    <option value="CL">📅  CL (Casual Leave)</option>
                    <option value="SL">🏥  SL (Sick Leave)</option>
                    <option value="CCL">👶  CCL</option>
                    <option value="Absent">❌  Absent</option>
                    <option value="LOP">💸  LOP (Loss of Pay)</option>
                  </select>
                  {submitted && statErr && (
                    <span className="field-error">Required</span>
                  )}
                </td>

                
                <td>
                  <input
                    type="time"
                    className={timeErr ? "bulk-input-error" : ""}
                    value={current.in}
                    disabled={isFrozen || !current.status}
                    onChange={e => handleUpdate(emp.id, "in", e.target.value)}
                  />
                  {timeErr && (
                    <span className="field-error">In-time required</span>
                  )}
                  {needsTime && !isFrozen && current.status && !current.in && !submitted && (
                    <span className="field-hint">Enter in-time</span>
                  )}
                </td>

              
                <td>
                  <input
                    type="time"
                    className={outBeforeIn ? "bulk-input-error" : ""}
                    value={current.out}
                    disabled={isFrozen || !current.status}
                    onChange={e => handleUpdate(emp.id, "out", e.target.value)}
                  />
                  {outBeforeIn && (
                    <span className="field-error">Before in-time</span>
                  )}
                </td>

              
                <td style={{ textAlign: "center", minWidth: 100 }}>
                  {isFrozen ? (
                    <span className="hours-leave">
                      {current.status}
                    </span>
                  ) : outBeforeIn ? (
                    <span className="hours-error">⚠ Invalid</span>
                  ) : hours ? (
                    <span className="hours-pill" style={hStyle}>
                      {hours.h}h {hours.m > 0 ? `${hours.m}m` : ""}
                    </span>
                  ) : current.in && !current.out ? (
                    <span className="hours-pending">In progress…</span>
                  ) : (
                    <span className="hours-empty">—</span>
                  )}
                </td>

              </tr>
            );
          })}
        </tbody>

        
        {totalHoursSummary > 0 && (
          <tfoot>

            <tr className="summary-row">
              <td colSpan={5} style={{ textAlign: "right", fontWeight: 700,
                fontSize: "0.82rem", color: "#1a3a6b", padding: "10px 12px" }}>
                Total Working Hours:
              </td>
              <td style={{ textAlign: "center", fontWeight: 700,
                color: "#1a3a6b", fontSize: "0.9rem", padding: "10px 12px" }}>
                {summaryH}h {summaryM}m
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
