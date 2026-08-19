import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import {
  LogOut, Calendar,
  ClipboardList, FileSpreadsheet,
  LayoutDashboard,
  GitBranch, Settings as SettingsIcon,
  FileText, Plane, MessageSquare,
  AlertCircle, CheckCircle, Info
} from "lucide-react";
import "../styles/EmployeeDashboard.css";
import "../styles/Leave.css";

const today       = new Date().toISOString().split("T")[0];
const maxYearDate = new Date(
  new Date().setFullYear(new Date().getFullYear() + 2)
).toISOString().split("T")[0];

export default function ApplyLeave({ inline = false, onClose }) {
  const navigate = useNavigate();


  const [user,       setUser]       = useState(null);
  const [profilePic, setProfilePic] = useState(null);

  
  const [form, setForm] = useState({
    leave_type:       "",
    from_date:        "",
    to_date:          "",
    reason:           "",
    certificate_path: ""
  });
  const [myLeaves, setMyLeaves] = useState([]);
  const [message,  setMessage]  = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [usage,    setUsage]    = useState({ cl: 0, ml: 0 });

  
  const countWorkingDays = (startStr, endStr) => {
    if (!startStr || !endStr) return 0;
    const start   = new Date(startStr);
    const end     = new Date(endStr);
    let count     = 0;
    let current   = new Date(start);
    while (current <= end) {
      const day = current.getUTCDay();
      if (day !== 0) count++; 
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return count;
  };

 
  const fetchMyLeaves = useCallback(async () => {
    try {
      const res = await api.get("/leave/my");
      setMyLeaves(res.data);

      const now          = new Date();
      const currentMonth = now.getMonth();
      const currentYear  = now.getFullYear();

      const monthlyUsage = res.data
        .filter(l => {
          const d = new Date(l.from_date);
          return (
            d.getMonth()    === currentMonth &&
            d.getFullYear() === currentYear  &&
            l.status        !== "rejected"
          );
        })
        .reduce(
          (acc, l) => {
            if (l.leave_type === "CL") acc.cl += Number(l.total_days);
            if (l.leave_type === "ML") acc.ml += Number(l.total_days);
            return acc;
          },
          { cl: 0, ml: 0 }
        );

      setUsage(monthlyUsage);
    } catch (err) {
      console.error("Failed to fetch my leaves", err);
    }
  }, []);

  
  useEffect(() => {
    const stored = sessionStorage.getItem("user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        if (parsed.profilePic) setProfilePic(parsed.profilePic);
      } catch {
        sessionStorage.clear();
        navigate("/login");
      }
    } else {
      navigate("/login");
    }
    fetchMyLeaves();
  }, [navigate, fetchMyLeaves]);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (new Date(form.to_date) < new Date(form.from_date)) {
      setError("To date cannot be before From date");
      return;
    }

    
    if (
      form.leave_type === "ML" &&
      countWorkingDays(form.from_date, form.to_date) > 2 &&
      !form.certificate_path.trim()
    ) {
      setError("A medical certificate link is required for ML requests longer than 2 working days.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/leave/apply", form);
      setMessage("Leave request submitted successfully.");
      setForm({
        leave_type: "", from_date: "", to_date: "",
        reason: "", certificate_path: ""
      });
      fetchMyLeaves();
      setTimeout(() => setMessage(""), 5000);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to apply leave");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = useCallback(() => {
    sessionStorage.clear();
    navigate("/login", { replace: true });
  }, [navigate]);

  const initials = (name = "") =>
    name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const isLead = user?.designation?.toLowerCase().includes("lead");

  // ── Status Helpers ──
  const statusConfig = (status) => {
    const s = (status || "pending").toLowerCase();
    if (s === "approved") return { bg: "#dcfce7", color: "#166534", label: "Approved" };
    if (s === "rejected") return { bg: "#fee2e2", color: "#991b1b", label: "Rejected" };
    return { bg: "#fff3cd", color: "#856404", label: "Pending" };
  };

  // ── Inline mode: render only the form content, no sidebar/topbar ──
  if (inline) {
    return (
      <div className="leave-scroll-content" style={{ padding: "0" }}>
        <div className="leave-grid">
          <div className="leave-card">
            <div className="leave-card-title">
              <Plane size={18} color="#4f46e5" />
              Submit New Request
            </div>
            {error && (
              <div className="leave-msg leave-msg-error">
                <AlertCircle size={16} /> {error}
              </div>
            )}
            {message && (
              <div className="leave-msg leave-msg-success">
                <CheckCircle size={16} /> {message}
              </div>
            )}
            <form className="leave-form" onSubmit={handleSubmit}>
              <div className="leave-form-group">
                <label className="leave-form-label">Leave Type</label>
                <select className="leave-select" name="leave_type" value={form.leave_type} onChange={handleChange} required>
                  <option value="">Select leave category...</option>
                  <option value="CL">Casual Leave (CL)</option>
                  <option value="ML">Medical Leave (ML)</option>
                  <option value="CCL">Compensatory Leave (CCL)</option>
                  <option value="LOP">Loss of Pay (LOP)</option>
                </select>
                {form.leave_type === "CL" && (
                  <div style={{ marginTop: "8px", fontSize: "12px", color: usage.cl >= 2 ? "#ef4444" : "#f59e0b", display: "flex", alignItems: "center", gap: "6px" }}>
                    <AlertCircle size={14} />
                    {usage.cl >= 2 ? "You have already used your 2 CL for this month." : usage.cl === 1 ? "You have 1 CL left for this month." : "You have 2 CL available for this month."}
                  </div>
                )}
                {form.leave_type === "ML" && (
                  <div style={{ marginTop: "8px", fontSize: "12px", color: usage.ml >= 12 ? "#ef4444" : "#64748b", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Info size={14} />
                    {usage.ml >= 12 ? "You have reached the 12 ML limit for this month." : `Current ML used this month: ${usage.ml} / 12 days.`}
                  </div>
                )}
              </div>
              {form.leave_type === "ML" && (
                <div className="leave-form-group">
                  <label className="leave-form-label">Medical Certificate Link (Required if &gt; 2 working days)</label>
                  <input className="leave-input" type="url" name="certificate_path" value={form.certificate_path} onChange={handleChange} placeholder="Paste viewable Google Drive link here..." />
                  {countWorkingDays(form.from_date, form.to_date) > 2 && (
                    <p style={{ fontSize: "11px", color: "#f59e0b", marginTop: "4px" }}>* A medical certificate is mandatory for requests longer than 2 working days.</p>
                  )}
                </div>
              )}
              <div className="leave-date-row">
                <div className="leave-form-group">
                  <label className="leave-form-label">From Date</label>
                  <input className="leave-input" type="date" name="from_date" value={form.from_date} onChange={handleChange} min={today} max={maxYearDate} required />
                </div>
                <div className="leave-form-group">
                  <label className="leave-form-label">To Date</label>
                  <input className="leave-input" type="date" name="to_date" value={form.to_date} onChange={handleChange} min={form.from_date || today} max={maxYearDate} required />
                </div>
              </div>
              {form.from_date && form.to_date && (
                <div style={{ marginBottom: "20px", padding: "10px 14px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "#64748b" }}>Total Working Days (Mon – Sat)</span>
                  <span style={{ fontSize: "15px", fontWeight: "700", color: "#4f46e5" }}>{countWorkingDays(form.from_date, form.to_date)} {countWorkingDays(form.from_date, form.to_date) === 1 ? "Day" : "Days"}</span>
                </div>
              )}
              <div className="leave-form-group">
                <label className="leave-form-label">Reason / Remarks</label>
                <textarea className="leave-textarea" name="reason" placeholder="Briefly explain the reason for your leave request..." value={form.reason} onChange={handleChange} required />
              </div>
              <button className="leave-submit-btn" type="submit" disabled={loading}>
                {loading ? "Submitting Request..." : "Apply for Leave"}
              </button>
            </form>
          </div>

          <div className="leave-card">
            <div className="leave-card-title">
              <FileText size={18} color="#4f46e5" />
              Recent Leave History
            </div>
            {myLeaves.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
                <Info size={32} style={{ marginBottom: "12px", opacity: 0.5 }} />
                <p style={{ fontSize: "14px" }}>No leave history found.</p>
              </div>
            ) : (
              <div className="leave-table-container">
                <table className="leave-table">
                  <thead><tr><th>Type</th><th>Duration</th><th>Days</th><th>Status</th><th>Approved By</th></tr></thead>
                  <tbody>
                    {myLeaves.map((leave) => {
                      const config = statusConfig(leave.status);
                      return (
                        <tr key={leave.id}>
                          <td><strong>{leave.leave_type}</strong></td>
                          <td>
                            <div style={{ fontSize: "13px", fontWeight: 600 }}>
                              {new Date(leave.from_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                              {" – "}
                              {new Date(leave.to_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                            </div>
                            <div style={{ fontSize: "11px", color: "#94a3b8" }}>{new Date(leave.from_date).getFullYear()}</div>
                          </td>
                          <td>{leave.total_days}</td>
                          <td><span className="leave-status-pill" style={{ background: config.bg, color: config.color }}>{config.label}</span></td>
                          <td style={{ fontSize: "0.82rem", minWidth: 120 }}>
                            {leave.approved_by_name ? (
                              <div>
                                <div style={{ fontWeight: 700, color: "#1e293b" }}>{leave.approved_by_name}</div>
                                <div style={{ fontSize: "0.72rem", fontWeight: 700, marginTop: 2, color: leave.approved_by_role === "super_admin" ? "#7c3aed" : "#2563eb" }}>
                                  {leave.approved_by_role === "super_admin" ? "Super Admin" : leave.approved_by_role === "admin" ? "Admin" : leave.approved_by_role || ""}
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: "0.78rem" }}>
                                {leave.status === "pending" ? "Awaiting" : "—"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="leave-page-wrapper">

      
      <aside className="emp-sidebar">
        <div className="emp-logo-area">
          <div className="emp-logo-mark">
            <div style={{
              width: 38, height: 38,
              background: "#ffffff",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden"
            }}>
              <img
                src={import.meta.env.VITE_LOGO_URL || "/logo.jpg"}
                alt="Logo"
                style={{ width: 34, height: 34, objectFit: "contain" }}
                onError={(e) => {
                  if (e.target.src !== window.location.origin + "/logo.jpg") {
                    e.target.src = "/logo.jpg";
                  } else {
                    e.target.style.display = "none";
                  }
                }}
              />
            </div>
            <div>
              <div className="emp-logo-text">WorkStockPro</div>
              <div className="emp-logo-sub">Employee Portal</div>
            </div>
          </div>
        </div>

        <nav className="emp-nav">
          <div className="emp-nav-label">MAIN</div>
          <div className="emp-nav-item" onClick={() => navigate("/employee-dashboard")}>
            <LayoutDashboard size={15} /> Dashboard
          </div>
          <div className="emp-nav-item" onClick={() => navigate("/attendance")}>
            <Calendar size={15} /> View Attendance
          </div>
          <div className="emp-nav-item emp-nav-active">
            <Plane size={15} /> Apply Leave
          </div>

          <div className="emp-nav-label">TOOLS</div>
          <div className="emp-nav-item" onClick={() => navigate("/dpr")}>
            <ClipboardList size={15} /> Daily Report
          </div>
          <div className="emp-nav-item" onClick={() => navigate("/request-panel")}>
            <MessageSquare size={15} /> Request Panel
          </div>
          <div className="emp-nav-item" onClick={() => navigate("/documents")}>
            <FileSpreadsheet size={15} /> Documents
          </div>

          {isLead && (
            <div className="emp-nav-item" onClick={() => navigate("/task-management")}>
              <GitBranch size={15} /> Team Tasks
            </div>
          )}

          <div className="emp-nav-item" onClick={() => navigate("/settings")}>
            <SettingsIcon size={15} /> Settings
          </div>
        </nav>

        <div className="emp-sidebar-footer">
          <button className="emp-logout-btn" onClick={handleLogout}>
            <LogOut size={15} /> Logout
          </button>
        </div>
      </aside>

      
      <div className="leave-content-area">

       
        <div className="emp-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button
              onClick={() => {
                const role = JSON.parse(sessionStorage.getItem("user"))?.role;
                if (role === "super_admin")  navigate("/super-admin-dashboard");
                else if (role === "admin")    navigate("/admin-dashboard");
                else                          navigate("/employee-dashboard");
              }}
              style={{
                background: "linear-gradient(135deg, #4f46e5, #4338ca)",
                color: "white",
                border: "none",
                padding: "6px 14px",
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "12px",
                cursor: "pointer",
                boxShadow: "0 4px 6px -1px rgba(79, 70, 229, 0.2)",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              ← Dashboard
            </button>
            <div>
              <div className="emp-page-title">Apply for Leave</div>
              <div className="emp-page-sub">Manage your time off requests</div>
            </div>
          </div>
          <div className="emp-topbar-right">
            <div className="emp-date-chip">
              {new Date().toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric"
              })}
            </div>
            <div className="emp-avatar-pill" onClick={() => navigate("/settings")}>
              {profilePic ? (
                <img src={profilePic} alt="Avatar" className="emp-avatar-img" />
              ) : (
                <div className="emp-avatar-initials">{initials(user?.fullname)}</div>
              )}
              <span className="emp-avatar-name">
                {user?.designation?.toUpperCase() || "EMPLOYEE"}
              </span>
            </div>
          </div>
        </div>

        
        <div className="leave-scroll-content">
          <div className="leave-grid">

            
            <div className="leave-card">
              <div className="leave-card-title">
                <Plane size={18} color="#4f46e5" />
                Submit New Request
              </div>

              {error && (
                <div className="leave-msg leave-msg-error">
                  <AlertCircle size={16} /> {error}
                </div>
              )}
              {message && (
                <div className="leave-msg leave-msg-success">
                  <CheckCircle size={16} /> {message}
                </div>
              )}

              <form className="leave-form" onSubmit={handleSubmit}>
                
                <div className="leave-form-group">
                  <label className="leave-form-label">Leave Type</label>
                  <select
                    className="leave-select"
                    name="leave_type"
                    value={form.leave_type}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select leave category...</option>
                    <option value="CL">Casual Leave (CL)</option>
                    <option value="ML">Medical Leave (ML)</option>
                    <option value="CCL">Compensatory Leave (CCL)</option>
                    <option value="LOP">Loss of Pay (LOP)</option>
                  </select>

                  {form.leave_type === "CL" && (
                    <div style={{
                      marginTop: "8px", fontSize: "12px",
                      color: usage.cl >= 2 ? "#ef4444" : "#f59e0b",
                      display: "flex", alignItems: "center", gap: "6px"
                    }}>
                      <AlertCircle size={14} />
                      {usage.cl >= 2
                        ? "You have already used your 2 CL for this month."
                        : usage.cl === 1
                          ? "You have 1 CL left for this month."
                          : "You have 2 CL available for this month."}
                    </div>
                  )}

                  {form.leave_type === "ML" && (
                    <div style={{
                      marginTop: "8px", fontSize: "12px",
                      color: usage.ml >= 12 ? "#ef4444" : "#64748b",
                      display: "flex", alignItems: "center", gap: "6px"
                    }}>
                      <Info size={14} />
                      {usage.ml >= 12
                        ? "You have reached the 12 ML limit for this month."
                        : `Current ML used this month: ${usage.ml} / 12 days.`}
                    </div>
                  )}
                </div>

               
                {form.leave_type === "ML" && (
                  <div className="leave-form-group">
                    <label className="leave-form-label">
                      Medical Certificate Link (Required if &gt; 2 working days)
                    </label>
                    <input
                      className="leave-input"
                      type="url"
                      name="certificate_path"
                      value={form.certificate_path}
                      onChange={handleChange}
                      placeholder="Paste viewable Google Drive link here..."
                    />
                    {countWorkingDays(form.from_date, form.to_date) > 2 && (
                      <p style={{ fontSize: "11px", color: "#f59e0b", marginTop: "4px" }}>
                        * A medical certificate is mandatory for requests longer than 2 working days.
                      </p>
                    )}
                  </div>
                )}

                
                <div className="leave-date-row">
                  <div className="leave-form-group">
                    <label className="leave-form-label">From Date</label>
                    <input
                      className="leave-input"
                      type="date"
                      name="from_date"
                      value={form.from_date}
                      onChange={handleChange}
                      min={today}
                      max={maxYearDate}
                      required
                    />
                  </div>
                  <div className="leave-form-group">
                    <label className="leave-form-label">To Date</label>
                    <input
                      className="leave-input"
                      type="date"
                      name="to_date"
                      value={form.to_date}
                      onChange={handleChange}
                      min={form.from_date || today}
                      max={maxYearDate}
                      required
                    />
                  </div>
                </div>

               
                {form.from_date && form.to_date && (
                  <div style={{
                    marginBottom: "20px",
                    padding: "10px 14px",
                    background: "#f8fafc",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <span style={{ fontSize: "13px", color: "#64748b" }}>
                      Total Working Days (Mon – Sat)
                    </span>
                    <span style={{ fontSize: "15px", fontWeight: "700", color: "#4f46e5" }}>
                      {countWorkingDays(form.from_date, form.to_date)}{" "}
                      {countWorkingDays(form.from_date, form.to_date) === 1 ? "Day" : "Days"}
                    </span>
                  </div>
                )}

                
                <div className="leave-form-group">
                  <label className="leave-form-label">Reason / Remarks</label>
                  <textarea
                    className="leave-textarea"
                    name="reason"
                    placeholder="Briefly explain the reason for your leave request..."
                    value={form.reason}
                    onChange={handleChange}
                    required
                  />
                </div>

                <button className="leave-submit-btn" type="submit" disabled={loading}>
                  {loading ? "Submitting Request..." : "Apply for Leave"}
                </button>
              </form>
            </div>

            
            <div className="leave-card">
              <div className="leave-card-title">
                <FileText size={18} color="#4f46e5" />
                Recent Leave History
              </div>

              {myLeaves.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
                  <Info size={32} style={{ marginBottom: "12px", opacity: 0.5 }} />
                  <p style={{ fontSize: "14px" }}>No leave history found.</p>
                </div>
              ) : (
                <div className="leave-table-container">
                  <table className="leave-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Duration</th>
                        <th>Days</th>
                        <th>Status</th>
                        <th>Approved By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myLeaves.map((leave) => {
                        const config = statusConfig(leave.status);
                        return (
                          <tr key={leave.id}>
                            <td><strong>{leave.leave_type}</strong></td>
                            <td>
                              <div style={{ fontSize: "13px", fontWeight: 600 }}>
                                {new Date(leave.from_date).toLocaleDateString("en-IN", {
                                  day: "2-digit", month: "short"
                                })}
                                {" – "}
                                {new Date(leave.to_date).toLocaleDateString("en-IN", {
                                  day: "2-digit", month: "short"
                                })}
                              </div>
                              <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                                {new Date(leave.from_date).getFullYear()}
                              </div>
                            </td>
                            <td>{leave.total_days}</td>
                            <td>
                              <span
                                className="leave-status-pill"
                                style={{ background: config.bg, color: config.color }}
                              >
                                {config.label}
                              </span>
                            </td>
                            <td style={{ fontSize: "0.82rem", minWidth: 120 }}>
                              {leave.approved_by_name ? (
                                <div>
                                  <div style={{ fontWeight: 700, color: "#1e293b" }}>{leave.approved_by_name}</div>
                                  <div style={{ fontSize: "0.72rem", fontWeight: 700, marginTop: 2, color: leave.approved_by_role === "super_admin" ? "#7c3aed" : "#2563eb" }}>
                                    {leave.approved_by_role === "super_admin" ? "Super Admin" : leave.approved_by_role === "admin" ? "Admin" : leave.approved_by_role || ""}
                                  </div>
                                </div>
                              ) : (
                                <span style={{ color: "#94a3b8", fontSize: "0.78rem" }}>
                                  {leave.status === "pending" ? "Awaiting" : "—"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}
