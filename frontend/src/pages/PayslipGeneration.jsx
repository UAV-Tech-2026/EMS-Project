import React, { useState, useEffect } from "react";
import { api } from "../utils/api";
import "../styles/PayslipGeneration.css";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

export default function PayslipGeneration() {
  const today        = new Date();
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-01`;
  const todayStr     = today.toISOString().split("T")[0];

  const [employees,   setEmployees]   = useState([]);
  const [selectedEmp, setSelectedEmp] = useState("");
  const [fromDate,    setFromDate]    = useState(firstOfMonth);
  const [toDate,      setToDate]      = useState(todayStr);
  const [payslip,     setPayslip]     = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [editMode,    setEditMode]    = useState(false);
  const [editSalary,  setEditSalary]  = useState({});
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    api.get("/payslip/employees")
      .then(r => setEmployees(r.data))
      .catch(console.error);
  }, []);

  const selectedEmployee = employees.find(e => String(e.id) === String(selectedEmp));

  const handleGenerate = async () => {
    if (!selectedEmp) return setError("Please select an employee");
    setLoading(true);
    setError("");
    setPayslip(null);
    try {
      const res = await api.get(
        `/payslip/generate?userId=${selectedEmp}&from=${fromDate}&to=${toDate}`
      );
      setPayslip(res.data);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to generate payslip");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSalary = async () => {
    setSaving(true);
    try {
      await api.put(`/payslip/salary/${selectedEmp}`, editSalary);
      const r = await api.get("/payslip/employees");
      setEmployees(r.data);
      setEditMode(false);
    } catch (err) {
      alert("Failed to save salary");
    } finally {
      setSaving(false);
    }
  };

  const fmt = n => "₹" + Number(n || 0).toLocaleString("en-IN");

  const monthLabel = () => {
    const d = new Date(fromDate);
    return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };

  const setQuickMonth = (offset) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - offset);
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const lastDay = new Date(y, d.getMonth()+1, 0).getDate();
    setFromDate(`${y}-${m}-01`);
    setToDate(offset === 0 ? todayStr : `${y}-${m}-${lastDay}`);
  };

  return (
    <div className="payslip-container">

      
      <div className="ps-controls-card">
        <div className="ps-controls-row">
          <div className="ps-control-field">
            <label>Employee</label>
            <select value={selectedEmp} onChange={e => {
              setSelectedEmp(e.target.value);
              setPayslip(null);
              setEditMode(false);
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
            <label>From Date</label>
            <input type="date" value={fromDate} max={toDate}
              onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="ps-control-field">
            <label>To Date</label>
            <input type="date" value={toDate} min={fromDate} max={todayStr}
              onChange={e => setToDate(e.target.value)} />
          </div>
          <button className="generate-btn" onClick={handleGenerate}
            disabled={loading || !selectedEmp}>
            {loading ? "⏳ Loading…" : "⚡ Generate"}
          </button>
        </div>

        
        <div className="ps-shortcuts">
          {[0,1,2].map(offset => {
            const d = new Date();
            d.setDate(1);
            d.setMonth(d.getMonth() - offset);
            const lbl = offset === 0
              ? "This Month"
              : `${MONTHS[d.getMonth()].slice(0,3)} ${d.getFullYear()}`;
            return (
              <button key={offset} className="shortcut-pill"
                onClick={() => setQuickMonth(offset)}>
                {lbl}
              </button>
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

            {!editMode ? (
              <button className="edit-salary-btn" onClick={() => {
                setEditSalary({
                  basic_salary: selectedEmployee.basic_salary,
                  hra:          selectedEmployee.hra,
                  epf_amount:   selectedEmployee.epf_amount,
                  pt_amount:    selectedEmployee.pt_amount,
                });
                setEditMode(true);
              }}>✏️ Edit Salary</button>
            ) : (
              <div className="ss-btn-row">
                <button className="cancel-btn" onClick={() => setEditMode(false)}>Cancel</button>
                <button className="save-salary-btn" onClick={handleSaveSalary} disabled={saving}>
                  {saving ? "Saving…" : "💾 Save"}
                </button>
              </div>
            )}
          </div>

          
          {!editMode ? (
            <div className="salary-display-grid">
              {[
                ["Basic Salary",  fmt(selectedEmployee.basic_salary), ""],
                ["HRA",           fmt(selectedEmployee.hra),          ""],
                ["Gross Salary",
                  fmt(Number(selectedEmployee.basic_salary) + Number(selectedEmployee.hra)),
                  "earn"],
                ["EPF (Fixed)",   fmt(selectedEmployee.epf_amount),   ""],
                ["Prof. Tax (PT)",fmt(selectedEmployee.pt_amount),     ""],
                ["Net (approx.)",
                  fmt(
                    Number(selectedEmployee.basic_salary) +
                    Number(selectedEmployee.hra) -
                    Number(selectedEmployee.epf_amount) -
                    Number(selectedEmployee.pt_amount)
                  ),
                  "net"],
              ].map(([label, value, type]) => (
                <div key={label} className={`salary-box ${type ? type+"-box" : ""}`}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          ) : (
            
            <div className="salary-edit-grid">
              {[
                ["Basic Salary (₹)", "basic_salary", "e.g. 20000"],
                ["HRA (₹)",          "hra",          "e.g. 8000"],
                ["EPF Amount (₹)",   "epf_amount",   "e.g. 1800"],
                ["Prof. Tax PT (₹)", "pt_amount",    "e.g. 200"],
              ].map(([label, key, placeholder]) => (
                <div key={key} className="edit-field">
                  <label>{label}</label>
                  <input
                    type="number"
                    min="0"
                    placeholder={placeholder}
                    value={editSalary[key] || ""}
                    onChange={e => setEditSalary(p => ({...p, [key]: e.target.value}))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      
      {payslip && (
        <div className="payslip-result">

         
          <div className="result-summary-grid">
            <div className="result-card gross-card">
              <span>Gross Salary</span>
              <strong>{fmt(payslip.salary.gross_salary)}</strong>
            </div>
            <div className="result-card deduct-card">
              <span>Total Deductions</span>
              <strong>−{fmt(payslip.salary.total_deductions)}</strong>
            </div>
            <div className="result-card net-card">
              <span>Net Salary</span>
              <strong>{fmt(payslip.salary.net_salary)}</strong>
            </div>
            <div className="result-card att-card">
              <span>Attendance</span>
              <strong>{payslip.attendance.present_days}/{payslip.attendance.working_days} days</strong>
              {payslip.attendance.lop_days > 0 &&
                <small className="lop-tag">{payslip.attendance.lop_days} LOP</small>}
            </div>
          </div>

       
          <div className="breakdown-card">
            <div className="breakdown-col">
              <div className="bc-header earn-h">Earnings</div>
              <div className="bc-row"><span>Basic Salary</span><span>{fmt(payslip.salary.basic)}</span></div>
              <div className="bc-row"><span>HRA</span><span>{fmt(payslip.salary.hra)}</span></div>
              <div className="bc-row bc-total earn-t">
                <span>Gross Salary</span><span>{fmt(payslip.salary.gross_salary)}</span>
              </div>
            </div>
            <div className="breakdown-col">
              <div className="bc-header deduct-h">Deductions</div>
              <div className="bc-row">
                <span>EPF</span>
                <span className="red">−{fmt(payslip.salary.epf_deduction)}</span>
              </div>
              <div className="bc-row">
                <span>Professional Tax (PT)</span>
                <span className="red">−{fmt(payslip.salary.pt_deduction)}</span>
              </div>
              <div className="bc-row">
                <span>LOP ({payslip.attendance.lop_days} days)</span>
                <span className="red">−{fmt(payslip.salary.lop_deduction)}</span>
              </div>
              <div className="bc-row bc-total deduct-t">
                <span>Total Deductions</span><span>−{fmt(payslip.salary.total_deductions)}</span>
              </div>
            </div>
          </div>

        
          <div className="net-salary-bar">
            <div>
              <div className="net-label">NET SALARY (TAKE HOME)</div>
              <div className="net-sub">
                {payslip.employee.fullname} · {fromDate} → {toDate}
              </div>
            </div>
            <div className="net-big">{fmt(payslip.salary.net_salary)}</div>
          </div>

          <div className="result-actions">
            <button className="preview-btn" onClick={() => setShowPreview(true)}>
              🖨️ Preview &amp; Print
            </button>
            <button className="back-btn" onClick={() => setPayslip(null)}>
              ↩ Back
            </button>
          </div>
        </div>
      )}

     
      {showPreview && payslip && (
        <div className="modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="payslip-print-wrapper" onClick={e => e.stopPropagation()}>

            <div className="print-toolbar no-print">
              <button className="close-preview-btn" onClick={() => setShowPreview(false)}>
                ✕ Close
              </button>
              <button className="print-action-btn" onClick={() => window.print()}>
                🖨️ Print / Save PDF
              </button>
            </div>

         
            <div className="payslip-doc" id="payslip-doc">

              <div className="psd-header">
                <div className="psd-company">
                  <div className="psd-logo">UAV</div>
                  <div>
                    <div className="psd-co-name">UAVTech Systems Pvt. Ltd.</div>
                    <div className="psd-co-addr">Hyderabad, Telangana — 500081</div>
                  </div>
                </div>
                <div className="psd-title-block">
                  <div className="psd-title">SALARY SLIP</div>
                  <div className="psd-period">{monthLabel()}</div>
                </div>
              </div>

              <div className="psd-emp-grid">
                {[
                  ["Employee Name",  payslip.employee.fullname],
                  ["Employee ID",    payslip.employee.employee_uav_id],
                  ["Designation",    payslip.employee.designation || "Employee"],
                  ["Pay Period",     `${fromDate} to ${toDate}`],
                  ["Working Days",   payslip.attendance.working_days],
                  ["Days Present",   payslip.attendance.present_days],
                  ["LOP Days",       payslip.attendance.lop_days],
                  ["Leave Days",     payslip.attendance.leave_days],
                  ["Half Days",      payslip.attendance.half_days],
                ].map(([label, val]) => (
                  <div key={label} className="psd-field">
                    <span>{label}</span>
                    <strong>{val}</strong>
                  </div>
                ))}
              </div>

              <div className="psd-sal-table">
                <div className="psd-col">
                  <div className="psd-col-hdr psd-earn-hdr">Earnings</div>
                  <div className="psd-row">
                    <span>Basic Salary</span>
                    <span>{fmt(payslip.salary.basic)}</span>
                  </div>
                  <div className="psd-row">
                    <span>House Rent Allowance (HRA)</span>
                    <span>{fmt(payslip.salary.hra)}</span>
                  </div>
                  <div className="psd-row psd-spacer" />
                  <div className="psd-row psd-total psd-earn-tot">
                    <span>Gross Salary</span>
                    <span>{fmt(payslip.salary.gross_salary)}</span>
                  </div>
                </div>

                <div className="psd-col">
                  <div className="psd-col-hdr psd-ded-hdr">Deductions</div>
                  <div className="psd-row">
                    <span>EPF (Employee Provident Fund)</span>
                    <span>{fmt(payslip.salary.epf_deduction)}</span>
                  </div>
                  <div className="psd-row">
                    <span>Professional Tax (PT)</span>
                    <span>{fmt(payslip.salary.pt_deduction)}</span>
                  </div>
                  <div className="psd-row">
                    <span>LOP Deduction ({payslip.attendance.lop_days} days)</span>
                    <span>{fmt(payslip.salary.lop_deduction)}</span>
                  </div>
                  <div className="psd-row psd-total psd-ded-tot">
                    <span>Total Deductions</span>
                    <span>{fmt(payslip.salary.total_deductions)}</span>
                  </div>
                </div>
              </div>

              <div className="psd-net">
                <span>NET SALARY (TAKE HOME)</span>
                <span>{fmt(payslip.salary.net_salary)}</span>
              </div>

              <div className="psd-footer">
                <div className="psd-sign">
                  <div className="psd-sign-line" />
                  <div>Employee Signature</div>
                </div>
                <div className="psd-note">
                  This is a computer-generated payslip and does not require a physical signature.
                </div>
                <div className="psd-sign">
                  <div className="psd-sign-line" />
                  <div>Authorized Signatory</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
