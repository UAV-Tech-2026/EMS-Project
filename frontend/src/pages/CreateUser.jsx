import { useState } from "react";
import { authApi } from "../utils/api";
import "../styles/CreateUser.css";
import { useNavigate, useOutletContext } from "react-router-dom";

// Role options per creator
const ROLE_OPTIONS = {
  super_admin: [
    { value: "admin", label: "Admin" },
    { value: "employee", label: "Employee" },
    { value: "intern", label: "Intern" },
  ],
  admin: [
    { value: "employee", label: "Employee" },
    { value: "intern", label: "Intern" },
  ],
};

const ROLE_FEATURES = {
  admin: [
    "Full Admin Dashboard Access",
    "Employee & Role Management",
    "Payroll & Salary Approvals",
    "Company Reports & Settings"
  ],
  hr_admin: [
    "HR Dashboard Access",
    "Employee Onboarding",
    "Leave & Attendance Review",
    "Payroll Processing"
  ],
  production_admin: [
    "Production Dashboard Access",
    "Task & DPR Oversight",
    "Team Management",
    "Attendance Tracking"
  ],
  employee: [
    "Employee Dashboard",
    "Mark Daily Attendance & DPR",
    "Request Leaves",
    "View Payslips"
  ],
  intern: [
    "Intern Dashboard",
    "Mark Daily Attendance & DPR",
    "Request Leaves"
  ]
};


export default function CreateUser({ onClose, onSuccess }) {
  const navigate = useNavigate();
  const context = useOutletContext() || {};
  const user = context.user || JSON.parse(localStorage.getItem("user") || "{}");
  const allowedRoles = ROLE_OPTIONS[user?.role] || [];

  const [experiences, setExperiences] = useState([
    { organization: "", role: "", from: "", to: "" },
  ]);

  const [salary, setSalary] = useState({
    basic_salary: "",
    hra: "",
    epf_amount: "",
    pt_amount: "",
  });

  const [emailError, setEmailError] = useState("");
  const [panError, setPanError] = useState("");
  const [qrCodeData, setQrCodeData] = useState(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [departments, setDepartments] = useState([
    "PRD-Product Research Department", "PED-Product Engineering Department", "PDD-Software", "PDD-I&TT", "PDD-FT&T",
    "PDD-PTI", "PMT", "BMD", "HR", "Operations"
  ]);
  const [showAddDept, setShowAddDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
 

  const addExperience = () => setExperiences([
    ...experiences,
    { organization: "", role: "", from: "", to: "" }
  ]);

  const removeExperience = (index) =>
    setExperiences(experiences.filter((_, i) => i !== index));

  const handleExperienceChange = (index, field, value) => {
    const updated = [...experiences];
    updated[index][field] = value;
    setExperiences(updated);
  };

  const handleSalaryChange = (field, value) =>
    setSalary(prev => ({ ...prev, [field]: value }));

  const handleEmailChange = (e) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@uavtech\.ai$/;
    setEmailError(
      e.target.value && !emailRegex.test(e.target.value)
        ? "Official email must end with @uavtech.ai"
        : ""
    );
  };

  const handlePanChange = (e) => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    const val = e.target.value.toUpperCase();
    e.target.value = val;
    setPanError(
      val && !panRegex.test(val)
        ? "Invalid PAN format. Expected: AAAAA9999A"
        : ""
    );
  };

  const basic = Number(salary.basic_salary) || 0;
  const hra = Number(salary.hra) || 0;
  const epf = Number(salary.epf_amount) || 0;
  const pt = Number(salary.pt_amount) || 0;
  const gross = basic + hra;
  const net = gross - epf - pt;
  const fmt = n => n > 0 ? "₹" + n.toLocaleString("en-IN") : "—";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (emailError) return alert("Please fix the email before submitting");
    if (panError) return alert("Please fix the PAN number before submitting");

    const payload = {
      fullname: e.target.fullname?.value || "",
      phone: e.target.phone?.value || "",
      email: e.target.email?.value || "",
      altEmail: e.target.altEmail?.value || "",
      designation: e.target.designation?.value || "",
      password: e.target.password?.value || "",
      role: e.target.role?.value || "",
      department: selectedDepartment,
      experiences: JSON.stringify(experiences),
      basic_salary: salary.basic_salary || 0,
      hra: salary.hra || 0,
      epf_amount: salary.epf_amount || 0,
      pt_amount: salary.pt_amount || 0,
      adhar: e.target.adhar?.value || "",
      addressProof: e.target.addressProof?.value || "",
      account_number: e.target.account_number?.value || "",
      pan_number: e.target.pan_number?.value ? e.target.pan_number.value.toUpperCase() : "",
    };

    try {
      const res = await authApi.post("/create-user", payload);
      alert("User Created Successfully!");

      if (res.data?.qrCode) {
        setQrCodeData(res.data.qrCode);
        return;
      }

      if (onSuccess) {
        onSuccess();
      } else {
        let path = "/employee-dashboard";
        if (user?.role === "super_admin") path = "/super-admin-dashboard";
        else if (user?.role === "admin_hr") path = "/admin-dashboard";
        else if (user?.role === "admin") path = "/admin-dashboard";
        navigate(path);
      }
    } catch (err) {
      const msg = err.response?.data?.msg || "Error creating user";
      alert(`Error: ${msg}`);
    }
  };

  const handleFinishAfterQR = () => {
    if (onSuccess) {
      onSuccess();
    } else {
      let path = "/employee-dashboard";
      if (user?.role === "super_admin") path = "/super-admin-dashboard";
      else if (user?.role === "admin_hr") path = "/admin-dashboard";
      else if (user?.role === "admin") path = "/admin-dashboard";
      navigate(path);
    }
  };

  return (
    <div className="create-user-wrapper">
      {qrCodeData && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.6)", zIndex: 9999,
          display: "flex", justifyContent: "center", alignItems: "center"
        }}>
          <div style={{
            background: "#fff", padding: "30px", borderRadius: "12px",
            textAlign: "center", maxWidth: "400px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)"
          }}>
            <h2 style={{ marginBottom: "15px", color: "#1e293b", fontSize: "1.2rem" }}>Share with Employee</h2>
            <p style={{ color: "#64748b", fontSize: "0.95rem", marginBottom: "20px" }}>
              Please have the employee scan this QR code immediately in their Google Authenticator app.
              They will need it for their first login.
            </p>
            <img src={qrCodeData} alt="Google Authenticator QR Code" style={{ width: "220px", height: "220px", border: "1px solid #e2e8f0", padding: "10px", borderRadius: "8px" }} />
            <div style={{ marginTop: "24px" }}>
              <button
                onClick={handleFinishAfterQR}
                style={{
                  background: "#1e293b", color: "#fff", padding: "10px 20px",
                  borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: "600"
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="create-top-nav" style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "24px",
        paddingBottom: "16px",
        borderBottom: "1px solid #e2e8f0"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <img
            src={import.meta.env.VITE_LOGO_URL || "/logo.jpg"}
            alt="Logo"
            style={{ height: "32px", mixBlendMode: 'multiply' }}
            onError={e => e.target.style.display = "none"}
          />
        </div>
        <div className="title-section" style={{ margin: 0 }}>
          <h1 style={{ margin: 0, fontSize: "1.2rem" }}>
            Create {selectedRole === "admin" ? "Admin" : selectedRole === "intern" ? "Intern" : "Employee"}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="create-form">
        <div className={`form-columns ${selectedRole === 'admin' ? 'admin-mode' : ''}`}>
          <div className="left-column">
            <input name="fullname" placeholder="Full Name" required />
            <input name="phone" placeholder="+91-XXXXXXXXXX"
              pattern="\+91-[0-9]{10}" required />
            <input name="email" placeholder="Official Email (@uavtech.ai)"
              onChange={handleEmailChange} required />
            {emailError && <div className="error-msg">{emailError}</div>}
            <input name="altEmail" type="email" placeholder="Alternate Email" />

            <input name="designation" placeholder="Designation" required />

           {/* Role dropdown — only show for admin creation */}
{user?.role === "super_admin" && (
  <select name="role" required value={selectedRole} onChange={e => setSelectedRole(e.target.value)}>
    <option value="">Select Role</option>
    {allowedRoles.map(opt => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
)}

{/* For non-super admins: role is auto-set, show department first */}
{user?.role !== "super_admin" && (
  <>
    <select
      name="department"
      required
      value={selectedDepartment}
      onChange={e => setSelectedDepartment(e.target.value)}
    >
      <option value="">Select Department</option>
      {departments.map(dept => (
        <option key={dept} value={dept}>{dept}</option>
      ))}
    </select>

    <select name="role" required value={selectedRole} onChange={e => setSelectedRole(e.target.value)}
      style={{ marginTop: 12 }}>
      <option value="">Select Role</option>
      <option value="employee">Employee</option>
      <option value="intern">Intern</option>
    </select>
  </>
)}

{/* Department for super_admin creating an admin */}
{user?.role === "super_admin" && selectedRole && ["admin","hr_admin","production_admin"].includes(selectedRole) && (
  <select name="department" required value={selectedDepartment}
    onChange={e => setSelectedDepartment(e.target.value)} style={{ marginTop: 15 }}>
    <option value="">Select Department</option>
    {departments.map(dept => (
      <option key={dept} value={dept}>{dept}</option>
    ))}
  </select>
)}

            <input name="password" type="password" placeholder="Password" required style={{ marginTop: "15px" }} />
          </div>

          {/* ── RIGHT COLUMN — Hidden for Admins ── */}
          {!["admin", "hr_admin", "production_admin"].includes(selectedRole) && (
            <div className="right-column">
              <h3>Experience</h3>
              {experiences.map((exp, index) => (
                <div key={index} className="experience-card">
                  <input placeholder="Organization" value={exp.organization}
                    onChange={e => handleExperienceChange(index, "organization", e.target.value)} />
                  <input placeholder="Role" value={exp.role}
                    onChange={e => handleExperienceChange(index, "role", e.target.value)} />
                  <input type="date" value={exp.from}
                    onChange={e => handleExperienceChange(index, "from", e.target.value)} />
                  <input type="date" value={exp.to}
                    onChange={e => handleExperienceChange(index, "to", e.target.value)} />
                  {experiences.length > 1 && (
                    <button type="button" className="remove-btn"
                      onClick={() => removeExperience(index)}>X</button>
                  )}
                </div>
              ))}
              <button type="button" className="add-btn" onClick={addExperience}>
                + Add Experience
              </button>

              <h3>Salary Breakdown</h3>
              <div className="salary-fixed-grid">
                {[
                  { key: "basic_salary", label: "Basic Salary", placeholder: "e.g. 20000" },
                  { key: "hra", label: "HRA", placeholder: "e.g. 8000" },
                  { key: "epf_amount", label: "EPF Amount", placeholder: "e.g. 1800" },
                  { key: "pt_amount", label: "Prof. Tax (PT)", placeholder: "e.g. 200" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="salary-field">
                    <label>{label}</label>
                    <div className="salary-input-wrap">
                      <span>₹</span>
                      <input type="number" min="0" placeholder={placeholder}
                        value={salary[key]}
                        onChange={e => handleSalaryChange(key, e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>

              {gross > 0 && (
                <div className="salary-preview">
                  <div className="sp-item"><span>Gross</span><strong className="sp-earn">{fmt(gross)}</strong></div>
                  <div className="sp-sep">−</div>
                  <div className="sp-item"><span>EPF + PT</span><strong className="sp-deduct">{fmt(epf + pt)}</strong></div>
                  <div className="sp-sep">=</div>
                  <div className="sp-item"><span>Net</span><strong className="sp-net">{fmt(net)}</strong></div>
                </div>
              )}

              <label className="doc-label">Valid Proof (Drive Link)</label>
              <input type="url" name="adhar" placeholder="Paste Google Drive link here" className="text-input-field" />
              <label className="doc-label">Address Proof (Drive Link)</label>
              <input type="url" name="addressProof" placeholder="Paste Google Drive link here" className="text-input-field" />

              <h3>Banking &amp; Tax Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label className="doc-label">Bank Account Number</label>
                  <input
                    name="account_number"
                    placeholder="e.g. 1234567890"
                    maxLength={20}
                    pattern="[0-9]{9,18}"
                    title="Enter a valid 9–18 digit account number"
                    className="text-input-field"
                  />
                </div>
                <div>
                  <label className="doc-label">PAN Number</label>
                  <input
                    name="pan_number"
                    placeholder="e.g. ABCDE1234F"
                    maxLength={10}
                    onChange={handlePanChange}
                    style={{ textTransform: "uppercase" }}
                    className="text-input-field"
                  />
                  {panError && <div className="error-msg">{panError}</div>}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="form-buttons">
          <button type="submit" className="submit-btn">Create User</button>
          <button
            type="button"
            className="back-btn"
            onClick={() => {
              if (onClose) {
                onClose();
              } else {
                let path = "/employee-dashboard";
                if (user?.role === "super_admin") path = "/super-admin-dashboard";
                else if (user?.role === "admin_hr") path = "/admin-dashboard";
                else if (user?.role === "admin") path = "/admin-dashboard";
                navigate(path);
              }
            }}
          >
            Back to Dashboard
          </button>
        </div>

      </form>
    </div>
  );
}
