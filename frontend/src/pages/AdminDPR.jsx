import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/AdminDPR.css";
function getISTDateString(offsetDays = 0) {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000 + offsetDays * 86400000);
  return ist.toISOString().split("T")[0];
}

function fmtTime(val) {
  if (!val) return "—";
  return String(val).slice(0, 5);
}

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_COLOR = {
  submitted: { bg: "rgba(16, 185, 129, 0.15)", color: "#10b981", label: "Submitted" },
  missing:   { bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444", label: "Missing"   },
};

function AdminDPR() {
  const today = getISTDateString(0);

  const [date,     setDate]     = useState(today);
  const [dprs,     setDprs]     = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [search,   setSearch]   = useState("");
  const [expanded, setExpanded] = useState(null); // user_id of expanded row
  const [tasks,    setTasks]    = useState({});   // { user_id: [...] }
  const [taskLoad, setTaskLoad] = useState({});   // { user_id: bool }

  const fetchDPRs = async (d) => {
    setLoading(true);
    setError("");
    setExpanded(null);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL}/dpr/all?date=${d}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDprs(data);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to fetch DPRs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDPRs(date); }, [date]);

  const toggleExpand = async (row) => {
  const key = row.id;
  if (expanded === key) { setExpanded(null); return; }
  setExpanded(key);
  if (tasks[key]) return;
  setTaskLoad(p => ({ ...p, [key]: true }));
  try {
    const token = localStorage.getItem("token");
    const { data } = await axios.get(
      `${import.meta.env.VITE_API_URL}/dpr/tasks/${row.user_id}?date=${row.dpr_date}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setTasks(p => ({ ...p, [key]: data || [] }));
  } catch {
    setTasks(p => ({ ...p, [key]: [] }));
  } finally {
    setTaskLoad(p => ({ ...p, [key]: false }));
  }
};

  const filtered = dprs.filter(d =>
    d.fullname.toLowerCase().includes(search.toLowerCase()) ||
    (d.designation || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.employee_uav_id || "").toLowerCase().includes(search.toLowerCase())
  );

  const submitted = dprs.length;

  return (
    
      <div className="adpr-wrap">

        {/* Header */}
        <div className="adpr-header">
          <div className="adpr-header-left">
            <h2>📋 DPR Overview</h2>
            <p>Daily Progress Reports — {fmtDate(date)}</p>
          </div>
          <div className="adpr-controls">
            <input
              type="date" className="adpr-date-input"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
            <input
              className="adpr-search"
              placeholder="🔍 Search employee, role, ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="adpr-stats">
          <div className="adpr-stat">
            <div className="val">{submitted}</div>
            <div className="lbl">Submitted</div>
          </div>
          <div className="adpr-stat">
            <div className="val" style={{ color: "#0ea5e9" }}>{filtered.length}</div>
            <div className="lbl">Showing</div>
          </div>
        </div>

        {error && <div className="adpr-error">{error}</div>}

        {/* Table */}
        <div className="adpr-card">
          {loading ? (
            <div className="adpr-loading">⏳ Loading DPRs…</div>
          ) : filtered.length === 0 ? (
            <div className="adpr-empty">
              <div className="icon">📭</div>
              <div>No DPRs submitted for this date.</div>
            </div>
          ) : (
            <table className="adpr-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Employee</th>
                  <th>UAV ID</th>
                  <th>Designation</th>
                  <th>Project</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Tasks</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => {
                  const isOpen = expanded === row.id;
                  const rowTasks = tasks[row.id] || [];
                  const isLoadingTasks = taskLoad[row.id];
                  const st = STATUS_COLOR.submitted;

                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        className={isOpen ? "expanded-row" : ""}
                        onClick={() => toggleExpand(row)}
                      >
                        <td className="adpr-mono">{i + 1}</td>
                        <td style={{ fontWeight: 700, color: "#ffffff" }}>{row.fullname}</td>
                        <td className="adpr-mono">{row.employee_uav_id || "—"}</td>
                        <td style={{ color: "#94a3b8" }}>{row.designation || "—"}</td>
                        <td style={{ color: "#cbd5e1" }}>{row.project || "—"}</td>
                        <td className="adpr-time">{fmtTime(row.clock_in)}</td>
                        <td className="adpr-time">{fmtTime(row.clock_out)}</td>
                        <td>{row.location || "Office"}</td>
                        <td>
                          <span
                            className="adpr-badge"
                            style={{ background: st.bg, color: st.color }}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td onClick={e => { e.stopPropagation(); toggleExpand(row); }}>
                          <button className="adpr-expand-btn">
                            {isOpen ? "▲ Hide" : "▼ View"}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded task subtable */}
                      {isOpen && (
                        <tr className="adpr-subtable-wrap">
                          <td colSpan={10}>
                            <div className="adpr-subtable-inner">
                              <h4>📝 Tasks — {row.fullname}</h4>
                              {isLoadingTasks ? (
                                <div className="adpr-no-tasks">Loading tasks…</div>
                              ) : rowTasks.length === 0 ? (
                                <div className="adpr-no-tasks">No task entries recorded.</div>
                              ) : (
                                <table className="adpr-subtable">
                                  <thead>
                                    <tr>
                                      <th>Start</th>
                                      <th>End</th>
                                      <th>Task Code</th>
                                      <th>Summary of Work Done</th>
                                      <th>Equipment / Software</th>
                                      <th>Personnel</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rowTasks.map((t, ti) => (
                                      <tr key={ti}>
                                        <td style={{ whiteSpace: "nowrap" }}>{fmtTime(t.start_time)}</td>
                                        <td style={{ whiteSpace: "nowrap" }}>{fmtTime(t.end_time)}</td>
                                        <td style={{ fontFamily: "monospace" }}>{t.task_code || "—"}</td>
                                        <td>{t.summary}</td>
                                        <td>{t.equipment || "—"}</td>
                                        <td>{t.personnel || "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}

                              {/* Requirement & Remarks */}
                              {(row.requirement || row.remarks) && (
                                <div className="adpr-remarks">
                                  <div className="adpr-remarks-box">
                                    <div className="rlbl">Requirement</div>
                                    <div className="rval">{row.requirement || "N/A"}</div>
                                  </div>
                                  <div className="adpr-remarks-box">
                                    <div className="rlbl">Remarks / Issues</div>
                                    <div className="rval">{row.remarks || "N/A"}</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>
    
  );
}
export default AdminDPR;