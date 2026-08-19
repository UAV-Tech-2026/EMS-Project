import { useState, useEffect } from "react";
import { api } from "../utils/api";
import { Calendar, Layers, Clock, X, Eye } from "lucide-react";
import "../styles/EmployeeDashboard.css"; // Reuse existing styles

export default function DPRHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedDate, setSelectedDate] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const res = await api.get("/dpr/my-history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError("Failed to load DPR history.");
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (date) => {
    setSelectedDate(date);
    setDetailsLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await api.get(`/dpr/my-dpr?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDetails(res.data);
    } catch (err) {
      setDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setSelectedDate(null);
    setDetails(null);
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "N/A";
    return String(timeStr).slice(0, 5); // Extract HH:MM
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div className="emp-section-header">
        <span className="emp-section-title">MY DPR HISTORY</span>
      </div>

      <div className="emp-bottom-card" style={{ padding: 16 }}>
        {loading ? (
          <div className="emp-empty-state">Loading history...</div>
        ) : error ? (
          <div className="emp-empty-state" style={{ color: "red" }}>{error}</div>
        ) : history.length === 0 ? (
          <div className="emp-empty-state">No DPRs found in your history.</div>
        ) : (
          <table className="emp-task-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Project</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.dpr_date}>
                  <td style={{ fontWeight: 600 }}>
                    {new Date(row.dpr_date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td>{row.project || "N/A"}</td>
                  <td>{formatTime(row.clock_in)}</td>
                  <td>{formatTime(row.clock_out)}</td>
                  <td>
                    <button
                      onClick={() => loadDetails(row.dpr_date)}
                      style={{
                        background: "#eff6ff",
                        color: "#3b82f6",
                        border: "none",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: "12px",
                      }}
                    >
                      <Eye size={14} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedDate && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 23, 42, 0.4)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(4px)", padding: 20
        }}>
          <div style={{
            background: "#fff", width: "100%", maxWidth: 800,
            borderRadius: 16, overflow: "hidden",
            boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
            display: "flex", flexDirection: "column",
            maxHeight: "90vh"
          }}>
            {/* Modal Header */}
            <div style={{
              background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
              padding: "20px 24px", display: "flex", alignItems: "center",
              justifyContent: "space-between", borderBottom: "1px solid #e2e8f0"
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: "#1e293b", display: "flex", alignItems: "center", gap: 10 }}>
                  <Calendar size={20} color="#3b82f6" /> 
                  DPR for {new Date(selectedDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </h2>
                <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                  Project: {details?.entry?.project || "N/A"} ({details?.entry?.project_code || "N/A"})
                </div>
              </div>
              <button onClick={closeDetails} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              {detailsLoading ? (
                <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>Loading details...</div>
              ) : !details?.entry ? (
                <div style={{ textAlign: "center", padding: 40, color: "red" }}>Could not load DPR details.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, background: "#f8fafc", padding: 16, borderRadius: 12 }}>
                    <div><span style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>Location:</span><br/> {details.entry.location || "N/A"}</div>
                    <div><span style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>Working Hours:</span><br/> {formatTime(details.entry.clock_in)} - {formatTime(details.entry.clock_out)}</div>
                  </div>

                  <div>
                    <h3 style={{ margin: "0 0 12px 0", fontSize: 14, color: "#334155", display: "flex", alignItems: "center", gap: 8 }}>
                      <Layers size={16} /> Task Breakdown
                    </h3>
                    {details.tasks && details.tasks.length > 0 ? (
                      <table className="emp-task-table">
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Code</th>
                            <th>Summary of Work Done</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.tasks.map((t, idx) => (
                            <tr key={idx}>
                              <td style={{ whiteSpace: "nowrap", color: "#64748b", fontSize: 12 }}>
                                {formatTime(t.start_time)} - {formatTime(t.end_time)}
                              </td>
                              <td style={{ fontWeight: 600, fontSize: 12 }}>{t.task_code || "-"}</td>
                              <td style={{ lineHeight: 1.5 }}>
                                <div>{t.summary}</div>
                                {(t.equipment || t.personnel) && (
                                  <div style={{ marginTop: 6, fontSize: 11, color: "#64748b" }}>
                                    {t.equipment && <span><strong>Eq:</strong> {t.equipment} </span>}
                                    {t.personnel && <span style={{ marginLeft: 8 }}><strong>Pers:</strong> {t.personnel}</span>}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ padding: 16, border: "1px dashed #cbd5e1", borderRadius: 8, color: "#64748b", textAlign: "center" }}>
                        No individual tasks recorded for this date.
                      </div>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div style={{ background: "#fff", border: "1px solid #e2e8f0", padding: 16, borderRadius: 12 }}>
                      <h4 style={{ margin: "0 0 8px 0", fontSize: 13, color: "#64748b" }}>Requirements / Blockers</h4>
                      <div style={{ fontSize: 13, color: "#334155" }}>{details.entry.requirement || "N/A"}</div>
                    </div>
                    <div style={{ background: "#fff", border: "1px solid #e2e8f0", padding: 16, borderRadius: 12 }}>
                      <h4 style={{ margin: "0 0 8px 0", fontSize: 13, color: "#64748b" }}>Remarks / Issues</h4>
                      <div style={{ fontSize: 13, color: "#334155" }}>{details.entry.remarks || "N/A"}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}
