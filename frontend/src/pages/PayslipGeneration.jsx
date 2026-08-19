import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import "../styles/PayslipGeneration.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function numberToWords(num) {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if (num === 0) return "Zero";
  const inWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + inWords(n % 100) : "");
    if (n < 100000) return inWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + inWords(n % 1000) : "");
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + inWords(n % 100000) : "");
    return inWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + inWords(n % 10000000) : "");
  };
  return "Rupees " + inWords(Math.floor(num)) + " Only";
}


const tdL = {
  border: "1px solid #ccc", padding: "5px 8px",
  fontWeight: "bold", background: "#f5f5f5", width: "22%"
};
const tdV = {
  border: "1px solid #ccc", padding: "5px 8px", width: "28%"
};
const tdAmt = {
  border: "1px solid #ccc", padding: "5px 8px", textAlign: "right", width: "28%"
};
const thEarn = {
  border: "1px solid #ccc", padding: "6px", background: "#c6c6c6",
  textAlign: "center", fontWeight: "bold"
};
const thDeduct = {
  border: "1px solid #ccc", padding: "6px", background: "#c6c6c6",
  textAlign: "center", fontWeight: "bold"
};

export default function PayslipGeneration({ readOnly: propReadOnly }) {
  const userRole = JSON.parse(sessionStorage.getItem("user"))?.role?.toLowerCase();
  const isSuperAdmin = userRole === "super_admin";

  const readOnly = propReadOnly ?? false;
  const navigate = useNavigate();
  const today = new Date();

  const [selMonth, setSelMonth] = useState(today.getMonth());
  const [selYear, setSelYear] = useState(today.getFullYear());

  const fromDate = `${selYear}-${String(selMonth + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(selYear, selMonth + 1, 0).getDate();
  const toDate = `${selYear}-${String(selMonth + 1).padStart(2, "0")}-${lastDay}`;

  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState("");
  const [payslip, setPayslip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editSalary, setEditSalary] = useState({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("generate");
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(false);



  const yearOptions = Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i);

  useEffect(() => {
    api.get("/payslip/employees")
      .then(r => setEmployees(r.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (activeTab === "history") fetchHistory();
  }, [activeTab]);

  const fetchHistory = async () => {
    setHistLoading(true);
    try {
      const res = await api.get("/payslip/history");
      setHistory(res.data);
    } catch (err) { console.error(err); }
    finally { setHistLoading(false); }
  };

  const selectedEmployee = employees.find(e => String(e.id) === String(selectedEmp));

  const handleGenerate = async () => {
    if (!selectedEmp) return setError("Please select an employee");
    setLoading(true); setError(""); setPayslip(null);
    try {
      const res = await api.get(
        `/payslip/generate?userId=${selectedEmp}&from=${fromDate}&to=${toDate}`
      );
      setPayslip(res.data);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to generate payslip");
    } finally { setLoading(false); }
  };

  const handleApprove = async () => {
    if (!payslip || !isSuperAdmin || readOnly) return;
    setSaving(true);
    try {
      await api.post("/payslip/approve", {
        userId: payslip.employee.id,
        month: payslip.period.month,
        from: fromDate, to: toDate,
        salary: payslip.salary,
        attendance: payslip.attendance
      });
      alert("Payroll approved and locked.");
      setPayslip({ ...payslip, is_approved: true });
    } catch (err) {
      alert(err.response?.data?.msg || "Failed to approve payroll");
    } finally { setSaving(false); }
  };

  const handleSaveSalary = async () => {
    if (readOnly) return;
    setSaving(true);
    try {
      await api.put(`/payslip/salary/${selectedEmp}`, editSalary);
      const r = await api.get("/payslip/employees");
      setEmployees(r.data);
      setEditMode(false);
    } catch { alert("Failed to save salary"); }
    finally { setSaving(false); }
  };

  const fmt = n => "₹" + Number(n || 0).toLocaleString("en-IN");

  const monthLabel = () => `${MONTHS[selMonth]} ${selYear}`;

  const monthName = (m) => {
    if (!m) return "";
    const [y, mm] = m.split("-");
    return `${MONTHS[parseInt(mm) - 1]} ${y}`;
  };

  const handleBackToDashboard = () => {
    const role = JSON.parse(sessionStorage.getItem("user"))?.role;
    if (role === "super_admin") navigate("/super-admin-dashboard");
    else if (role === "admin") navigate("/admin-dashboard");
    else navigate("/employee-dashboard");
  };

  return (
    <div className="ps-page-wrapper">

      {/* ── Top Nav ── */}
      <div className="ps-top-nav" style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "24px",
        padding: "12px 0",
        borderBottom: "1px solid #e2e8f0"
      }}>
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
            <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1e293b", margin: 0 }}>Payroll Master</h1>
            <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>Generate & Manage Employee Payslips</p>
          </div>
        </div>
      </div>

      
      <div className="ps-tabs-header">
        <button
          className={`ps-tab-btn ${activeTab === "generate" ? "active" : ""}`}
          onClick={() => setActiveTab("generate")}
        >
          ⚡ Generate Monthly
        </button>
        <button
          className={`ps-tab-btn ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          📜 Payroll Table (Cumulative)
        </button>
      </div>

      {activeTab === "generate" ? (
        <>
          
          <div className="ps-controls-card">
            <div className="ps-controls-row">

              
              <div className="ps-control-field">
                <label>Employee</label>
                <select value={selectedEmp} onChange={e => {
                  setSelectedEmp(e.target.value);
                  setPayslip(null); setEditMode(false);
                }}>
                  <option value="">— Select Employee —</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullname} ({emp.employee_uav_id})
                    </option>
                  ))}
                </select>
              </div>

              
              <div className="ps-control-field">
                <label>Month</label>
                <select value={selMonth} onChange={e => { setSelMonth(Number(e.target.value)); setPayslip(null); }}>
                  {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>

              
              <div className="ps-control-field">
                <label>Year</label>
                <select value={selYear} onChange={e => { setSelYear(Number(e.target.value)); setPayslip(null); }}>
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <button
                className="generate-btn"
                onClick={handleGenerate}
                disabled={loading || !selectedEmp || readOnly}
              >
                {loading ? " Loading…" : readOnly ? "View Only" : "⚡ Generate"}
              </button>
            </div>

            
            <div className="ps-shortcuts">
              {[0, 1, 2].map(offset => {
                const d = new Date();
                d.setDate(1);
                d.setMonth(d.getMonth() - offset);
                const lbl = offset === 0
                  ? "This Month"
                  : `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
                return (
                  <button key={offset} className="shortcut-pill" onClick={() => {
                    setSelMonth(d.getMonth());
                    setSelYear(d.getFullYear());
                    setPayslip(null);
                  }}>{lbl}</button>
                );
              })}
            </div>

            {error && <div className="ps-error">⚠️ {error}</div>}
          </div>

          
          {selectedEmployee && !payslip && !loading && (
            <div className="salary-settings-card">
              <div className="ss-header">
                <div className="ss-emp-info">
                  <div className="ss-avatar">{selectedEmployee.fullname.charAt(0)}</div>
                  <div>
                    <div className="ss-name">{selectedEmployee.fullname}</div>
                    <div className="ss-id">
                      {selectedEmployee.employee_uav_id}
                      {selectedEmployee.designation ? ` · ${selectedEmployee.designation}` : ""}
                    </div>
                  </div>
                </div>
                {isSuperAdmin && !readOnly && (
                  !editMode ? (
                    <button className="edit-salary-btn" onClick={() => {
                      setEditSalary({
                        basic_salary: selectedEmployee.basic_salary,
                        hra: selectedEmployee.hra,
                        epf_amount: selectedEmployee.epf_amount,
                        pt_amount: selectedEmployee.pt_amount,
                      });
                      setEditMode(true);
                    }}>✏️ Edit Base Salary</button>
                  ) : (
                    <div className="ss-btn-row">
                      <button className="cancel-btn" onClick={() => setEditMode(false)}>Cancel</button>
                      <button className="save-salary-btn" onClick={handleSaveSalary} disabled={saving}>
                        {saving ? "Saving…" : " Save"}
                      </button>
                    </div>
                  )
                )}
              </div>

              {!editMode ? (
                <div className="salary-display-grid">
                  {[
                    ["Basic Salary", fmt(selectedEmployee.basic_salary), ""],
                    ["HRA", fmt(selectedEmployee.hra), ""],
                    ["Gross Salary", fmt(Number(selectedEmployee.basic_salary) + Number(selectedEmployee.hra)), "earn"],
                    ["EPF (Fixed)", fmt(selectedEmployee.epf_amount), ""],
                    ["Prof. Tax (PT)", fmt(selectedEmployee.pt_amount), ""],
                    ["Net (approx.)", fmt(
                      Number(selectedEmployee.basic_salary) +
                      Number(selectedEmployee.hra) -
                      Number(selectedEmployee.epf_amount) -
                      Number(selectedEmployee.pt_amount)
                    ), "net"],
                  ].map(([label, value, type]) => (
                    <div key={label} className={`salary-box ${type ? type + "-box" : ""}`}>
                      <span>{label}</span><strong>{value}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="salary-edit-grid">
                  {[
                    ["Basic Salary (₹)", "basic_salary", "e.g. 20000"],
                    ["HRA (₹)", "hra", "e.g. 8000"],
                    ["EPF Amount (₹)", "epf_amount", "e.g. 1800"],
                    ["Prof. Tax PT (₹)", "pt_amount", "e.g. 200"],
                  ].map(([label, key, placeholder]) => (
                    <div key={key} className="edit-field">
                      <label>{label}</label>
                      <input
                        type="number" min="0" placeholder={placeholder}
                        value={editSalary[key] || ""}
                        onChange={e => setEditSalary(p => ({ ...p, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          
          {payslip && (
            <div className="payslip-result">

              
              <div className="cumulative-stats-grid" style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                gap: "15px", marginBottom: "20px"
              }}>
                <div className="stat-card" style={{ background: "#f0f9ff", padding: "15px", borderRadius: "8px", border: "1px solid #bae6fd" }}>
                  <span style={{ fontSize: "12px", color: "#0369a1", fontWeight: "bold" }}>YTD Gross Earnings</span>
                  <div style={{ fontSize: "18px", fontWeight: "bold" }}>
                    {fmt(payslip.cumulative.ytd_gross + (payslip.is_approved ? 0 : payslip.salary.gross_salary))}
                  </div>
                </div>
                <div className="stat-card" style={{ background: "#fff1f2", padding: "15px", borderRadius: "8px", border: "1px solid #fecdd3" }}>
                  <span style={{ fontSize: "12px", color: "#be123c", fontWeight: "bold" }}>YTD Total Deductions</span>
                  <div style={{ fontSize: "18px", fontWeight: "bold" }}>
                    {fmt(payslip.cumulative.ytd_deductions + (payslip.is_approved ? 0 : payslip.salary.total_deductions))}
                  </div>
                </div>
                <div className="stat-card" style={{ background: "#f0fdf4", padding: "15px", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                  <span style={{ fontSize: "12px", color: "#15803d", fontWeight: "bold" }}>YTD Net Salary</span>
                  <div style={{ fontSize: "18px", fontWeight: "bold" }}>
                    {fmt(payslip.cumulative.ytd_net + (payslip.is_approved ? 0 : payslip.salary.net_salary))}
                  </div>
                </div>
              </div>

              
              <div className="result-summary-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px" }}>
                <div className="result-card net-card" style={{ padding: "20px", background: "#f8fafc", borderRadius: "10px", borderLeft: "5px solid #4f46e5" }}>
                  <span style={{ color: "#64748b", fontSize: "13px" }}>Current Month Net Take Home</span>
                  <div style={{ fontSize: "24px", fontWeight: "800", color: "#1e293b" }}>{fmt(payslip.salary.net_salary)}</div>
                  <small style={{ color: "#94a3b8" }}>Based on {payslip.attendance.present_days} days present</small>
                </div>
                <div className="result-card" style={{ padding: "20px", background: "#f8fafc", borderRadius: "10px", borderLeft: "5px solid #059669" }}>
                  <span style={{ color: "#64748b", fontSize: "13px" }}>Gross Salary</span>
                  <div style={{ fontSize: "24px", fontWeight: "800", color: "#1e293b" }}>{fmt(payslip.salary.gross_salary)}</div>
                </div>
              </div>

              
              <div className="breakdown-card" style={{ display: "flex", gap: "20px", background: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <div className="breakdown-col" style={{ flex: 1 }}>
                  <div className="bc-header earn-h" style={{ fontWeight: "bold", borderBottom: "2px solid #059669", marginBottom: "10px", paddingBottom: "5px" }}>Earnings</div>
                  <div className="bc-row" style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
                    <span>Basic</span><span>{fmt(payslip.salary.basic)}</span>
                  </div>
                  <div className="bc-row" style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
                    <span>HRA</span><span>{fmt(payslip.salary.hra)}</span>
                  </div>
                </div>
                <div className="breakdown-col" style={{ flex: 1 }}>
                  <div className="bc-header deduct-h" style={{ fontWeight: "bold", borderBottom: "2px solid #ef4444", marginBottom: "10px", paddingBottom: "5px" }}>Deductions</div>
                  <div className="bc-row" style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
                    <span>EPF</span><span style={{ color: "#ef4444" }}>−{fmt(payslip.salary.epf_deduction)}</span>
                  </div>
                  <div className="bc-row" style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
                    <span>Prof. Tax</span><span style={{ color: "#ef4444" }}>−{fmt(payslip.salary.pt_deduction)}</span>
                  </div>
                  <div className="bc-row" style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
                    <span>LOP ({payslip.attendance.lop_days} days)</span>
                    <span style={{ color: "#ef4444" }}>−{fmt(payslip.salary.lop_deduction)}</span>
                  </div>
                </div>
              </div>

              
              <div className="result-actions" style={{ marginTop: "25px", display: "flex", gap: "10px" }}>
                {isSuperAdmin && !payslip.is_approved && (
                  <button
                    className="approve-btn"
                    onClick={handleApprove}
                    disabled={saving || readOnly}
                    style={{ background: readOnly ? "#94a3b8" : "#059669", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "6px", fontWeight: "bold", cursor: readOnly ? "not-allowed" : "pointer" }}
                  >
                    {saving ? " Approving..." : "✅ Approve & Lock"}
                  </button>
                )}
                {payslip.is_approved && (
                  <span className="approved-badge" style={{ background: "#dcfce7", color: "#166534", padding: "10px 15px", borderRadius: "6px", fontWeight: "bold" }}>
                    ✓ Approved
                  </span>
                )}
                <button
                  className="preview-btn"
                  onClick={() => setShowPreview(true)}
                  style={{ padding: "10px 20px", borderRadius: "6px", cursor: "pointer" }}
                >
                  🖨️ Preview
                </button>
                <button
                  className="back-btn"
                  onClick={() => setPayslip(null)}
                  style={{ padding: "10px 20px", borderRadius: "6px", cursor: "pointer" }}
                >
                  ↩ Back
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        
        <div className="payroll-history-view">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ margin: 0 }}>Approved Payroll History (Jan - Dec)</h3>
            <button className="shortcut-pill" onClick={fetchHistory} disabled={histLoading}>
              {histLoading ? " Loading..." : "🔄 Refresh Table"}
            </button>
          </div>
          <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
            {history.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                No approved records found.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                    {["ID", "Name", "Month", "Gross", "Deductions", "Net Paid", "Status"].map(h => (
                      <th key={h} style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(row => (
                    <tr key={row.id}>
                      <td style={{ padding: "12px", borderBottom: "1px solid #f1f5f9" }}>{row.employee_uav_id}</td>
                      <td style={{ padding: "12px", borderBottom: "1px solid #f1f5f9" }}><strong>{row.fullname}</strong></td>
                      <td style={{ padding: "12px", borderBottom: "1px solid #f1f5f9" }}>{monthName(row.month)}</td>
                      <td style={{ padding: "12px", borderBottom: "1px solid #f1f5f9" }}>{fmt(row.gross)}</td>
                      <td style={{ padding: "12px", borderBottom: "1px solid #f1f5f9", color: "#ef4444" }}>
                        −{fmt(Number(row.epf) + Number(row.pt) + Number(row.lop))}
                      </td>
                      <td style={{ padding: "12px", borderBottom: "1px solid #f1f5f9", color: "#4f46e5", fontWeight: 700 }}>
                        {fmt(row.net_salary)}
                      </td>
                      <td style={{ padding: "12px", borderBottom: "1px solid #f1f5f9" }}>
                        <span style={{ padding: "4px 8px", borderRadius: "12px", background: "#dcfce7", color: "#166534", fontSize: "11px", fontWeight: 600 }}>
                          Approved
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      
      {showPreview && payslip && (
        <div className="modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="payslip-print-wrapper" onClick={e => e.stopPropagation()}>

            <div className="print-toolbar no-print">
              <button className="close-preview-btn" onClick={() => setShowPreview(false)}>✕ Close</button>
              <button className="print-action-btn" onClick={() => window.print()}>🖨️ Print / Save PDF</button>
            </div>

            
            <div className="payslip-doc" id="payslip-doc" style={{
              fontFamily: "Arial, sans-serif", fontSize: "12px",
              width: "750px", margin: "0 auto", background: "#fff",
              padding: "30px", border: "1px solid #ccc"
            }}>

              
              <div style={{ textAlign: "center", marginBottom: "16px" }}>
                <img
                  src={import.meta.env.VITE_LOGO_URL || "/logo.jpg"}
                  alt="UAV Tech Logo"
                  style={{ height: "50px", marginBottom: "6px" }}
                  onError={e => e.target.style.display = "none"}
                />
                <div style={{ fontWeight: "bold", fontSize: "15px" }}>UAV Tech Pvt. Ltd.</div>
                <div style={{ fontSize: "12px" }}>Hyderabad - 500077</div>
                <div style={{ fontWeight: "bold", fontSize: "13px", marginTop: "6px", textDecoration: "underline" }}>
                  Salary Slip
                </div>
                <div style={{ fontSize: "12px" }}>Month: {monthLabel()}</div>
              </div>

              
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "14px" }}>
                <tbody>
                  <tr>
                    <td style={tdL}>Employee's Name</td>
                    <td style={tdV}>{payslip.employee.fullname}</td>
                    <td style={tdL}>Employee ID</td>
                    <td style={tdV}>{payslip.employee.employee_uav_id}</td>
                  </tr>
                  <tr>
                    <td style={tdL}>Designation</td>
                    <td style={tdV}>{payslip.employee.designation || "Employee"}</td>
                    <td style={tdL}>Days in Month</td>
                    <td style={tdV}>{payslip.attendance.working_days}</td>
                  </tr>
                  <tr>
                    <td style={tdL}>Pay Period</td>
                    <td style={tdV}>{monthLabel()}</td>
                    <td style={tdL}>Paid Days</td>
                    <td style={tdV}>
                      {(payslip.attendance.working_days || 0) - (payslip.attendance.lop_days || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td style={tdL}>Days Present</td>
                    <td style={tdV}>{payslip.attendance.present_days}</td>
                    <td style={tdL}>LOP Days</td>
                    <td style={tdV}>{payslip.attendance.lop_days}</td>
                  </tr>
                  <tr>
                    <td style={tdL}>Half Days</td>
                    <td style={tdV}>{payslip.attendance.half_days ?? "—"}</td>
                    <td style={tdL}>OT Hours</td>
                    <td style={tdV}>{payslip.attendance.ot_hours || 0}</td>
                  </tr>
                </tbody>
              </table>

              
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "14px" }}>
                <thead>
                  <tr>
                    <th colSpan={2} style={thEarn}>Earnings</th>
                    <th colSpan={2} style={thDeduct}>Deductions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={tdL}>Basic Salary</td>
                    <td style={tdAmt}>{Number(payslip.salary.basic).toLocaleString("en-IN")}</td>
                    <td style={tdL}>EPF (Employee PF)</td>
                    <td style={tdAmt}>{Number(payslip.salary.epf_deduction).toLocaleString("en-IN")}</td>
                  </tr>
                  <tr>
                    <td style={tdL}>HRA</td>
                    <td style={tdAmt}>{Number(payslip.salary.hra).toLocaleString("en-IN")}</td>
                    <td style={tdL}>Professional Tax</td>
                    <td style={tdAmt}>{Number(payslip.salary.pt_deduction).toLocaleString("en-IN")}</td>
                  </tr>
                  <tr>
                    <td style={tdL}>Overtime Pay</td>
                    <td style={tdAmt}>{Number(payslip.salary.ot_pay || 0).toLocaleString("en-IN")}</td>
                    <td style={tdL}>LOP Deduction</td>
                    <td style={tdAmt}>{Number(payslip.salary.lop_deduction).toLocaleString("en-IN")}</td>
                  </tr>
                  <tr>
                    <td style={tdL}></td><td style={tdAmt}></td>
                    <td style={tdL}></td><td style={tdAmt}></td>
                  </tr>
                  
                  <tr style={{ background: "#d9d9d9", fontWeight: "bold" }}>
                    <td style={tdL}>Gross</td>
                    <td style={tdAmt}>
                      {(Number(payslip.salary.gross_salary) + Number(payslip.salary.ot_pay || 0)).toLocaleString("en-IN")}
                    </td>
                    <td style={tdL}>Total Deductions</td>
                    <td style={tdAmt}>{Number(payslip.salary.total_deductions).toLocaleString("en-IN")}</td>
                  </tr>
                </tbody>
              </table>

            
              <div style={{ marginBottom: "6px" }}>
                <strong>Net Pay: </strong>
                {Number(payslip.salary.net_salary).toLocaleString("en-IN")}
              </div>
              <div style={{ marginBottom: "20px" }}>
                <strong>In Words: </strong>
                {numberToWords(Math.round(payslip.salary.net_salary))}
              </div>

              
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px", fontSize: "11px" }}>
                <thead>
                  <tr>
                    <th colSpan={3} style={{ ...thEarn, textAlign: "center" }}>
                      Year-to-Date Summary ({new Date(fromDate).getFullYear()})
                    </th>
                  </tr>
                  <tr style={{ background: "#f0f0f0" }}>
                    <th style={{ border: "1px solid #ccc", padding: "5px" }}>YTD Gross</th>
                    <th style={{ border: "1px solid #ccc", padding: "5px" }}>YTD Deductions</th>
                    <th style={{ border: "1px solid #ccc", padding: "5px" }}>YTD Net</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #ccc", padding: "5px", textAlign: "right" }}>
                      {fmt(payslip.cumulative.ytd_gross + (payslip.is_approved ? 0 : payslip.salary.gross_salary))}
                    </td>
                    <td style={{ border: "1px solid #ccc", padding: "5px", textAlign: "right" }}>
                      {fmt(payslip.cumulative.ytd_deductions + (payslip.is_approved ? 0 : payslip.salary.total_deductions))}
                    </td>
                    <td style={{ border: "1px solid #ccc", padding: "5px", textAlign: "right" }}>
                      {fmt(payslip.cumulative.ytd_net + (payslip.is_approved ? 0 : payslip.salary.net_salary))}
                    </td>
                  </tr>
                </tbody>
              </table>

              
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "30px" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ borderTop: "1px solid #000", width: "160px", marginBottom: "4px" }}></div>
                  <div>Employee Signature</div>
                </div>
                <div style={{ textAlign: "center", fontSize: "10px", color: "#666", maxWidth: "250px" }}>
                  This is a computer-generated payslip and does not require a physical signature.
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ borderTop: "1px solid #000", width: "160px", marginBottom: "4px" }}></div>
                  <div>Authorised Signatory</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      
    </div> 
  );
}
