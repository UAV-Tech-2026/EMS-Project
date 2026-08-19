import React, { useState, useEffect, useCallback } from "react";
import { api } from "../utils/api";
import "../styles/BulkAttendance.css";
import { useNavigate } from "react-router-dom";
import axios from "axios";

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


function DPRModal({ emp, date, onClose, onMark }) {
  const [dprEntry, setDprEntry] = useState(null);
  const [dprTasks, setDprTasks] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  useEffect(() => {
    const fetchDPR = async () => {
      setLoading(true);
      setError("");
      try {
        const token = sessionStorage.getItem("token");
        const baseUrl = import.meta.env.VITE_API_URL;

        // Fetch DPR entry (summary row)
        const allRes = await axios.get(
          `${baseUrl}/dpr/all?date=${date}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const entry = (allRes.data || []).find(r => r.user_id === emp.id) || null;
        setDprEntry(entry);

        // Fetch tasks if entry found
        if (entry) {
          const taskRes = await axios.get(
            `${baseUrl}/dpr/tasks/${emp.id}?date=${date}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setDprTasks(taskRes.data || []);
        }
      } catch (err) {
        setError("Failed to load DPR.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDPR();
  }, [emp.id, date]);

 
  const deadlinePassed = (() => {
    const now = new Date();
    
    const deadlineIST = new Date(date + "T18:30:00.000Z"); 
    
    const [y, m, d] = date.split("-").map(Number);
    const midnightIST = new Date(Date.UTC(y, m - 1, d, 18, 30, 0)); // midnight IST of that date (end of day)
    return now > midnightIST;
  })();

  const dprSubmitted = !!dprEntry;

  
  const suggestedStatus = dprSubmitted ? "Present" : (deadlinePassed ? "Absent" : null);

  const fmtT = (v) => (v ? String(v).slice(0, 5) : "—");

  return (
    <div className="dpr-modal-overlay" onClick={onClose}>
      <div className="dpr-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="dpr-modal-header">
          <div>
            <h3 className="dpr-modal-title">📋 DPR — {emp.fullname}</h3>
            <p className="dpr-modal-sub">{emp.employee_uav_id} · {date}</p>
          </div>
          <button className="dpr-modal-close" onClick={onClose}>✕</button>
        </div>

    
        <div className="dpr-modal-body">
          {loading ? (
            <div className="dpr-modal-loading">⏳ Loading DPR…</div>
          ) : error ? (
            <div className="dpr-modal-error">{error}</div>
          ) : !dprSubmitted ? (
            <div className="dpr-modal-empty">
              <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
              <div style={{ fontWeight: 700, color: "#dc2626", fontSize: "1rem", marginBottom: 4 }}>No DPR Submitted</div>
              <div style={{ color: "#64748b", fontSize: "0.85rem" }}>
                {deadlinePassed
                  ? "Deadline (midnight) has passed. This employee will be marked Absent."
                  : "DPR not yet submitted. Deadline is midnight of this date."}
              </div>
            </div>
          ) : (
            <>
            
              <div className="dpr-modal-info-grid">
                <div className="dpr-info-item"><span className="dpr-info-lbl">Project</span><span className="dpr-info-val">{dprEntry.project || "—"}</span></div>
                <div className="dpr-info-item"><span className="dpr-info-lbl">Location</span><span className="dpr-info-val">{dprEntry.location || "Office"}</span></div>
                <div className="dpr-info-item"><span className="dpr-info-lbl">Clock-In</span><span className="dpr-info-val dpr-time-chip">{fmtT(dprEntry.clock_in)}</span></div>
                <div className="dpr-info-item"><span className="dpr-info-lbl">Clock-Out</span><span className="dpr-info-val dpr-time-chip">{fmtT(dprEntry.clock_out)}</span></div>
              </div>

            
              {dprTasks.length > 0 && (
                <div style={{ overflowX: "auto", marginTop: 16 }}>
                  <table className="dpr-modal-tasks-table">
                    <thead>
                      <tr>
                        <th>Start</th>
                        <th>End</th>
                        <th>Task Code</th>
                        <th>Summary</th>
                        <th>Equipment</th>
                        <th>Personnel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dprTasks.map((t, i) => (
                        <tr key={i}>
                          <td>{fmtT(t.start_time)}</td>
                          <td>{fmtT(t.end_time)}</td>
                          <td style={{ fontFamily: "monospace" }}>{t.task_code || "—"}</td>
                          <td>{t.summary}</td>
                          <td>{t.equipment || "—"}</td>
                          <td>{t.personnel || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            
              {(dprEntry.requirement || dprEntry.remarks) && (
                <div className="dpr-modal-remarks">
                  {dprEntry.requirement && <div><strong>Requirement:</strong> {dprEntry.requirement}</div>}
                  {dprEntry.remarks && <div style={{ marginTop: 4 }}><strong>Remarks:</strong> {dprEntry.remarks}</div>}
                </div>
              )}
            </>
          )}
        </div>

        
        {!loading && !error && (
          <div className="dpr-modal-footer">
            {suggestedStatus === "Present" && (
              <>
                <div className="dpr-suggest-badge dpr-suggest-present">✅ DPR Submitted — Mark as Present</div>
                <button className="dpr-action-btn dpr-btn-present" onClick={() => { onMark(emp.id, "Present", dprEntry); onClose(); }}>
                  Mark Present
                </button>
              </>
            )}
            {suggestedStatus === "Absent" && (
              <>
                <div className="dpr-suggest-badge dpr-suggest-absent">⛔ No DPR — Deadline Passed — Mark as Absent</div>
                <button className="dpr-action-btn dpr-btn-absent" onClick={() => { onMark(emp.id, "Absent", null); onClose(); }}>
                  Mark Absent
                </button>
              </>
            )}
            {!suggestedStatus && (
              <div className="dpr-suggest-badge" style={{ background: "#fef9c3", color: "#92400e" }}>⏳ Awaiting DPR — Deadline not yet reached</div>
            )}
            <button className="dpr-action-btn dpr-btn-cancel" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BulkAttendance() {
  const [employees,     setEmployees]     = useState([]);
  const [date,          setDate]          = useState(new Date().toISOString().split("T")[0]);
  const [attendanceData,setAttendanceData]= useState({});
  const [loading,       setLoading]       = useState(true);
  const [submitted,     setSubmitted]     = useState(false);
  const [selectedDept,  setSelectedDept]  = useState("All");
  const [dprModal,      setDprModal]      = useState(null); // { emp }
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setSubmitted(false);

        const [empRes, recordRes] = await Promise.all([
          api.get("/attendance/employees-list"),
          api.get(`/attendance/today?date=${date}`)
        ]);

        const loggedInUser = JSON.parse(sessionStorage.getItem("user") || "{}");
        const filteredEmps = empRes.data.filter(
          u => u.role !== "super_admin"
        ).sort((a, b) => {
          const idA = a.employee_uav_id || "";
          const idB = b.employee_uav_id || "";
          return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
        });

        const initial = {};
        filteredEmps.forEach(emp => {
          const existing = recordRes.data.find(r => r.user_id === emp.id);
          
          const inTime  = existing?.check_in  || "";
          const outTime = existing?.check_out || "";

          
          let safeOut = outTime;
          if (inTime && outTime) {
            const [ih, im] = inTime.split(":").map(Number);
            const [oh, om] = outTime.split(":").map(Number);
            if ((oh * 60 + om) <= (ih * 60 + im)) safeOut = "";
          }

          initial[emp.id] = {
            status: existing?.status   || "",
            in:     inTime,
            out:    safeOut,
            ot:     existing?.ot_hours || ""
          };
        });

        setEmployees(filteredEmps);
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

  const departments = ["All", ...new Set(employees.map(e => e.department).filter(Boolean))];
  const displayedEmployees = employees.filter(e => selectedDept === "All" || e.department === selectedDept);

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
      check_out:       attendanceData[emp.id].out || null,
      ot_hours:        attendanceData[emp.id].ot  || 0
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

      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", paddingBottom: "20px", borderBottom: "1.5px solid #e2e8f0" }}>
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
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1e293b", margin: 0 }}>Bulk Attendance Log</h1>
            <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>Date — {date}</p>
          </div>
        </div>
      </div>

      <div className="bulk-header">
        

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>

          
          {totalHoursSummary > 0 && (
            <span className="badge-hours">
              🕐 Total: {summaryH}h {summaryM}m across {displayedEmployees.filter(e => {
                const d = attendanceData[e.id];
                return d && calcHours(d.in, d.out);
              }).length} employees
            </span>
          )}

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              fontSize: "0.85rem",
              outline: "none",
              color: "#1e293b",
              background: "#f8fafc",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

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
            <th>OT Hours</th>
            <th>Total Hours</th>
            <th style={{ textAlign: "center" }}>DPR</th>
          </tr>
        </thead>
        <tbody>
          {displayedEmployees.map(emp => {
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
                <td>
                  <div style={{ fontWeight: 600 }}>{emp.fullname || "Unnamed"}</div>
                  {emp.department && (
                    <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 400, marginTop: "2px" }}>
                      {emp.department}
                    </div>
                  )}
                </td>

               
                <td>
                  <select
                    className={"status-select" + (statErr ? " bulk-input-error" : "")}
                    value={current.status}
                    onChange={e => handleUpdate(emp.id, "status", e.target.value)}
                  >
                    <option value="">— Select Status —</option>
                    <option value="Present"> Present</option>
                    <option value="0.5">  Half Day (0.5)</option>
                    <option value="Field Work"> Field Work</option>
                    <option value="CL">  CL (Casual Leave)</option>
                    <option value="SL"> SL (Sick Leave)</option>
                    <option value="CCL"> CCL</option>
                    <option value="Absent">  Absent</option>
                    <option value="LOP">  LOP (Loss of Pay)</option>
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

                {/* OT Hours */}
                <td style={{ textAlign: "center" }}>
                  <input
                    type="number"
                    min="0"
                    max="12"
                    step="0.5"
                    value={current.ot}
                    disabled={isFrozen || !current.status}
                    placeholder="0"
                    onChange={e => handleUpdate(emp.id, "ot", e.target.value)}
                    style={{
                      width: 64,
                      padding: "4px 6px",
                      borderRadius: 6,
                      border: "1px solid #e2e8f0",
                      fontSize: "0.85rem",
                      textAlign: "center",
                      outline: "none",
                      background: isFrozen || !current.status ? "#f1f5f9" : "#fff",
                      color: current.ot > 0 ? "#7c3aed" : "#94a3b8",
                      fontWeight: current.ot > 0 ? 700 : 400
                    }}
                  />
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

                {/* DPR View Button */}
                <td style={{ textAlign: "center", minWidth: 90 }}>
                  <button
                    className="dpr-view-btn"
                    onClick={() => setDprModal({ emp })}
                    title="View DPR & auto-mark attendance"
                  >
                    📋 View DPR
                  </button>
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
                color: "#7c3aed", fontSize: "0.85rem", padding: "10px 12px" }}>
                {(() => {
                  const totalOT = employees.reduce((acc, emp) => {
                    const ot = parseFloat(attendanceData[emp.id]?.ot || 0);
                    return acc + (isNaN(ot) ? 0 : ot);
                  }, 0);
                  return totalOT > 0 ? `${totalOT}h OT` : "—";
                })()}
              </td>
              <td style={{ textAlign: "center", fontWeight: 700,
                color: "#1a3a6b", fontSize: "0.9rem", padding: "10px 12px" }}>
                {summaryH}h {summaryM}m
              </td>
            </tr>
          </tfoot>
        )}
      </table>

      {/* DPR Modal */}
      {dprModal && (
        <DPRModal
          emp={dprModal.emp}
          date={date}
          onClose={() => setDprModal(null)}
          onMark={(empId, status, dprEntry) => {
            setAttendanceData(prev => ({
              ...prev,
              [empId]: {
                ...prev[empId],
                status,
                in:  status === "Present" && dprEntry?.clock_in  ? String(dprEntry.clock_in).slice(0,5)  : (status === "Absent" ? "" : prev[empId]?.in  || ""),
                out: status === "Present" && dprEntry?.clock_out ? String(dprEntry.clock_out).slice(0,5) : (status === "Absent" ? "" : prev[empId]?.out || "")
              }
            }));
          }}
        />
      )}
      
    </div>
  );
}
