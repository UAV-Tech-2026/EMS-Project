import { useState, useEffect } from "react";
import { authApi, api } from "../utils/api";
import "../styles/CreateUser.css";
import { useNavigate, useOutletContext } from "react-router-dom";


const inp = {
  width: "100%", padding: "10px 14px",
  border: "1px solid #e2e8f0", borderRadius: 8,
  fontSize: 14, fontFamily: "DM Sans, sans-serif",
  outline: "none", boxSizing: "border-box",
  background: "#fff", color: "#1e293b",
};
const lbl = {
  fontSize: 12, fontWeight: 700, color: "#64748b",
  textTransform: "uppercase", letterSpacing: "0.04em",
  marginBottom: 4, display: "block",
};
const fld = { display: "flex", flexDirection: "column", gap: 4 };
const sectionTitle = {
  fontWeight: 800, fontSize: 12, color: "#475569",
  textTransform: "uppercase", letterSpacing: "0.07em",
  marginBottom: 2, marginTop: 8,
};

// ─────────────────────────────────────────────────────────────────────────────
export default function CreateUser({ onClose, onSuccess, readOnly }) {
  const navigate = useNavigate();
  const context = useOutletContext() || {};
  const user = context.user || JSON.parse(sessionStorage.getItem("user") || "{}");
  const [allowedRoles, setAllowedRoles] = useState([]);
  const [departments, setDepartments] = useState([]);



  // ── Form meta ────────────────────────────────────────────────────────────────
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem("user") || "{}");
      if (cached?.role === "super_admin") return "";
      const d = cached?.department || "";
      return d ? d.split(",")[0].trim() : "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    if (user?.role && user?.role !== "super_admin") {
      const d = user?.department || "";
      setSelectedDepartment(d ? d.split(",")[0].trim() : "");
    }
  }, [user]);

  // ── Errors ───────────────────────────────────────────────────────────────────
  const [emailError, setEmailError] = useState("");
  const [panError, setPanError] = useState("");


  const [experiences, setExperiences] = useState([
    { organization: "", role: "", from: "", to: "" },
  ]);


  const [salary, setSalary] = useState({
    basic_salary: "", hra: "", epf_amount: "", pt_amount: "",
  });


  const [deptAdmins, setDeptAdmins] = useState([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState("");


  const [qrCode, setQrCode] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [qrScanned, setQrScanned] = useState(false);
  const [createdInfo, setCreatedInfo] = useState({ username: "", employee_uav_id: "" });
  const [showPassword, setShowPassword] = useState(false);



  const isAdminRole = selectedRole === "admin";
  const isEmployeeRole = ["employee", "intern"].includes(selectedRole);

  const basic = Number(salary.basic_salary) || 0;
  const hra = Number(salary.hra) || 0;
  const epf = Number(salary.epf_amount) || 0;
  const pt = Number(salary.pt_amount) || 0;
  const gross = basic + hra;
  const net = gross - epf - pt;
  const fmt = n => n > 0 ? "₹" + n.toLocaleString("en-IN") : "—";


  // Fetch roles and departments dynamically from API
  useEffect(() => {
    api.get("/meta/roles-for-caller")
      .then(res => setAllowedRoles(Array.isArray(res.data) ? res.data : []))
      .catch(() => {
        setAllowedRoles([
          { value: "admin", label: "Admin" },
          { value: "employee", label: "Employee" },
          { value: "intern", label: "Intern" },
        ]);
      });

    api.get("/meta/departments")
      .then(res => {
        const raw = Array.isArray(res.data) ? res.data : [];
        // Deduplicate — keep unique names (case-insensitive), prefer the longer/full name
        const seen = new Map();
        raw.forEach(d => {
          const name = typeof d === "object" ? d.name : d;
          const key = name.trim().toLowerCase();
          if (!seen.has(key) || name.length > seen.get(key).length) {
            seen.set(key, name);
          }
        });
        setDepartments([...seen.values()]);
      })
      .catch(() => setDepartments([
        "Product Research Department (PRD)", "Product Engineering Department (PED)",
        "Product Development Department - Software", "Product Development Department - I&TT",
        "Product Development Department - FT&T", "Product Development Department - PTI",
        "Project Management Team (PMT)", "Business Management Department (BMD)",
        "Quality Assurance (QA)", "Human Resources (HR)", "Operations",
      ]));
  }, [user?.role]);

  useEffect(() => {
    setSelectedAdminId("");
    setDeptAdmins([]);
    if (isAdminRole) return;

    setAdminsLoading(true);
    api.get("/employees/all-assignable")
      .then(res => {
        const admins = (res.data || []).filter(
          u => u.role === "admin" || u.role === "super_admin"
        );
        setDeptAdmins(admins);
      })
      .catch(() => setDeptAdmins([]))
      .finally(() => setAdminsLoading(false));
  }, [selectedDepartment, selectedRole]);

  const handleEmailChange = e => {
    const ok = /^[a-zA-Z0-9._%+-]+@uavtech\.ai$/.test(e.target.value);
    setEmailError(e.target.value && !ok ? "Must end with @uavtech.ai" : "");
  };
  const handlePanChange = e => {
    const val = e.target.value.toUpperCase();
    e.target.value = val;
    setPanError(val && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(val) ? "Invalid PAN — expected AAAAA9999A" : "");
  };


  // ── Experience helpers ────────────────────────────────────────────────────────
  const addExp = () => setExperiences([...experiences, { organization: "", role: "", from: "", to: "" }]);
  const removeExp = i => setExperiences(experiences.filter((_, idx) => idx !== i));
  const changeExp = (i, f, v) => { const a = [...experiences]; a[i][f] = v; setExperiences(a); };

  // ── After QR dismissed ────────────────────────────────────────────────────────
  const afterQr = () => {
    setShowQr(false); setQrCode("");
    if (onSuccess) { onSuccess(); return; }
    let p = "/employee-dashboard";
    if (user?.role === "super_admin") p = "/super-admin-dashboard";
    else if (user?.role === "admin") p = "/admin-dashboard";
    navigate(p);
  };

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async e => {
    e.preventDefault();
    if (readOnly) return;
    if (emailError) return alert("Fix email first");
    if (panError) return alert("Fix PAN number first");

    const g = n => e.target[n]?.value || "";
    const payload = {
      title: g("title") || "Mr.",
      fullname: g("fullname").trim(),
      phone: g("phone").trim(),
      email: g("email").trim(),
      altEmail: g("altEmail").trim(),
      designation: g("designation").trim(),
      password: g("password"),
      role: g("role"),
      department: selectedDepartment,
      employee_uav_id: g("employee_uav_id").trim().toUpperCase(),
      assigned_admin: selectedAdminId || null,
      experiences: JSON.stringify(experiences),
      basic_salary: salary.basic_salary || 0,
      hra: salary.hra || 0,
      epf_amount: salary.epf_amount || 0,
      pt_amount: salary.pt_amount || 0,
      adhar: g("adhar"),
      addressProof: g("addressProof"),
      police_certificate: g("police_certificate"),
      medical_certificate: g("medical_certificate"),
      offer_letter_path: g("offer_letter_path"),
      nda_path: g("nda_path"),
      hr_docs_path: g("hr_docs_path"),
      account_number: g("account_number"),
      ifsc_code: g("ifsc_code").toUpperCase(),
      bank_name: g("bank_name"),
      branch_name: g("branch_name"),
      pan_number: g("pan_number").toUpperCase(),
    };

    try {
      const res = await authApi.post("/create-user", payload);
      if (res.data.qrCode) {
        setCreatedInfo({
          username: res.data.username || payload.email,
          employee_uav_id: res.data.employee_uav_id || payload.employee_uav_id,
        });
        setQrCode(res.data.qrCode);
        setShowQr(true);
      } else {
        alert("User Created Successfully!");
        afterQr();
      }
    } catch (err) {
      alert(`Error: ${err.response?.data?.msg || "Failed to create user"}`);
    }
  };

  const handleBack = () => {
    if (onClose) { onClose(); return; }
    let p = "/employee-dashboard";
    if (user?.role === "super_admin") p = "/super-admin-dashboard";
    else if (user?.role === "admin") p = "/admin-dashboard";
    navigate(p);
  };


  return (
    <div className="create-user-wrapper">

      {/* ── Top bar ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #e2e8f0"
      }}>
        <img src={import.meta.env.VITE_LOGO_URL || "/logo.jpg"} alt="Logo"
          style={{ height: 32, mixBlendMode: "multiply" }}
          onError={e => e.target.style.display = "none"} />
        <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#1e293b" }}>
          {isAdminRole ? "Enroll Admin" : selectedRole === "intern" ? "Enroll Intern" : "Enroll Employee"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="create-form">


        <div style={{
          background: "linear-gradient(135deg,#f0f9ff,#e0f2fe)",
          border: "1px solid #bae6fd", borderRadius: 12,
          padding: "16px 20px", marginBottom: 24,
          display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end",
        }}>
          {/* Role */}
          <div style={{ ...fld, flex: 1, minWidth: 160 }}>
            <label style={lbl}>Role *</label>
            <select name="role" required value={selectedRole}
              onChange={e => { setSelectedRole(e.target.value); setSelectedDepartment(""); }}
              style={inp}>
              <option value="">— Select Role —</option>
              {allowedRoles.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Department */}
          {selectedRole && (
            <div style={{ ...fld, flex: 1, minWidth: 200 }}>
              <label style={lbl}>Department *</label>
              {(user?.role === "super_admin" || isAdminRole) ? (
                <select
                  name="department"
                  required
                  value={selectedDepartment}
                  onChange={e => setSelectedDepartment(e.target.value)}
                  style={inp}
                >
                  <option value="">— Select Department —</option>
                  {departments.map(d => {
                    const val = typeof d === "object" ? d.name : d;
                    return (
                      <option key={val} value={val}>
                        {val}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <div style={{
                  ...inp, background: "#f1f5f9", color: "#64748b",
                  display: "flex", alignItems: "center", justifyContent: "space-between"
                }}>
                  <span>{selectedDepartment || "—"}</span>
                  <span style={{
                    fontSize: 10, background: "#e2e8f0",
                    padding: "2px 8px", borderRadius: 20
                  }}>Auto</span>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedRole && (
          <>

            {isAdminRole && (
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
                background: "#fff", border: "1px solid #e2e8f0",
                borderRadius: 12, padding: 24,
              }}>
                <div style={fld}>
                  <label style={lbl}>Full Name *</label>
                  <input name="fullname" placeholder="e.g. Ravi Kumar" required style={inp} />
                </div>
                <div style={fld}>
                  <label style={lbl}>Phone *</label>
                  <input name="phone" placeholder="+91-XXXXXXXXXX"
                    pattern="\+91-[0-9]{10}" required style={inp} />
                </div>
                <div style={fld}>
                  <label style={lbl}>Official Email *</label>
                  <input name="email" placeholder="name@uavtech.ai"
                    onChange={handleEmailChange} required style={inp} />
                  {emailError && <span style={{ color: "#ef4444", fontSize: 11 }}>{emailError}</span>}
                </div>
                <div style={fld}>
                  <label style={lbl}>Alternate Email</label>
                  <input name="altEmail" type="email" placeholder="personal@gmail.com" style={inp} />
                </div>
                <div style={fld}>
                  <label style={lbl}>Designation *</label>
                  <input name="designation" placeholder="e.g. HR Manager" required style={inp} />
                </div>
                <div style={{ ...fld, position: "relative" }}>
                  <label style={lbl}>Employee ID</label>
                  <div style={{ ...inp, background: "#f1f5f9", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #e2e8f0" }}>
                    <span>Auto-generated by system</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#64748b", background: "#e2e8f0", padding: "2px 6px", borderRadius: 4 }}>AUTO</span>
                  </div>
                </div>
                <div style={fld}>
                  <label style={lbl}>Password *</label>
                  <div style={{ position: "relative" }}>
                    <input name="password" type={showPassword ? "text" : "password"}
                      placeholder="Min 6 characters" required style={{ ...inp, paddingRight: "30px" }} />
                    <span onClick={() => setShowPassword(!showPassword)}
                      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#64748b" }}>
                      {showPassword ? "🙈" : "👁️"}
                    </span>
                  </div>
                </div>
                <div />
              </div>
            )}


            {isEmployeeRole && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

                {/* ── LEFT COLUMN ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                  {/* ── Personal & Account Card ── */}
                  <div style={{
                    background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12,
                    padding: "20px 22px", boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                    display: "flex", flexDirection: "column", gap: 14
                  }}>
                    <div style={{ ...sectionTitle, borderBottom: "1px solid #f1f5f9", paddingBottom: 8, margin: 0 }}>
                      Personal & Account
                    </div>

                    <div style={fld}>
                      <label style={lbl}>Title & Full Name *</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <select name="title" style={{ ...inp, width: 85, flexShrink: 0 }}>
                          <option value="Mr.">Mr.</option>
                          <option value="Mrs.">Mrs.</option>
                          <option value="Ms.">Ms.</option>
                          <option value="Dr.">Dr.</option>
                        </select>
                        <input name="fullname" placeholder="e.g. Priya Sharma" required style={inp} />
                      </div>
                    </div>
                    <div style={fld}>
                      <label style={lbl}>Phone *</label>
                      <input name="phone" placeholder="+91-XXXXXXXXXX"
                        pattern="\+91-[0-9]{10}" required style={inp} />
                    </div>
                    <div style={fld}>
                      <label style={lbl}>Official Email *</label>
                      <input name="email" placeholder="name@uavtech.ai"
                        onChange={handleEmailChange} required style={inp} />
                      {emailError && <span style={{ color: "#ef4444", fontSize: 11 }}>{emailError}</span>}
                    </div>
                    <div style={fld}>
                      <label style={lbl}>Alternate Email</label>
                      <input name="altEmail" type="email" placeholder="personal@gmail.com" style={inp} />
                    </div>
                    <div style={fld}>
                      <label style={lbl}>Designation *</label>
                      <input name="designation" placeholder="e.g. Software Engineer" required style={inp} />
                    </div>

                    <div style={{ ...fld, position: "relative" }}>
                      <label style={lbl}>Employee ID</label>
                      <div style={{ ...inp, background: "#f1f5f9", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #e2e8f0" }}>
                        <span>Auto-generated by system</span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: "#64748b", background: "#e2e8f0", padding: "2px 6px", borderRadius: 4 }}>AUTO</span>
                      </div>
                    </div>

                    <div style={fld}>
                      <label style={lbl}>Password *</label>
                      <div style={{ position: "relative" }}>
                        <input name="password" type={showPassword ? "text" : "password"}
                          placeholder="Min 6 characters" required style={{ ...inp, paddingRight: "50px" }} />
                        <span onClick={() => setShowPassword(!showPassword)}
                          style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#64748b", fontSize: 11, fontWeight: 600 }}>
                          {showPassword ? "Hide" : "Show"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Assign to Admin Card ── */}
                  <div style={{
                    background: selectedDepartment ? "#f0fdf4" : "#ffffff",
                    border: `1px solid ${selectedDepartment ? "#bbf7d0" : "#e2e8f0"}`,
                    borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                    display: "flex", flexDirection: "column", gap: 10
                  }}>
                    <div style={{ ...sectionTitle, color: selectedDepartment ? "#166534" : "#475569", borderBottom: "1px solid #f1f5f9", paddingBottom: 8, margin: 0 }}>
                      Assign to Admin
                    </div>

                    {adminsLoading ? (
                      <div style={{ ...inp, color: "#64748b", fontSize: 13 }}>
                        Loading admins…
                      </div>
                    ) : deptAdmins.length === 0 ? (
                      <div style={{
                        ...inp, background: "#fef9c3", color: "#92400e",
                        fontSize: 12, border: "1px solid #fde68a"
                      }}>
                        No admins available in system
                      </div>
                    ) : (
                      <select value={selectedAdminId}
                        onChange={e => setSelectedAdminId(e.target.value)}
                        style={{ ...inp, borderColor: "#bbf7d0" }}>
                        <option value="">— No specific admin —</option>
                        {deptAdmins
                          .filter(a => selectedDepartment && (a.department || "").toLowerCase().includes(selectedDepartment.toLowerCase()))
                          .length > 0 && (
                          <optgroup label={`Department Admins (${selectedDepartment})`}>
                            {deptAdmins
                              .filter(a => selectedDepartment && (a.department || "").toLowerCase().includes(selectedDepartment.toLowerCase()))
                              .sort((a, b) => (a.employee_uav_id || "").localeCompare(b.employee_uav_id || "", undefined, { numeric: true }))
                              .map(a => (
                                <option key={a.id} value={a.id}>
                                  {a.fullname} ({a.employee_uav_id || "Admin"}) {a.department ? `[${a.department}]` : ""}
                                </option>
                              ))}
                          </optgroup>
                        )}
                        {deptAdmins
                          .filter(a => !selectedDepartment || !(a.department || "").toLowerCase().includes(selectedDepartment.toLowerCase()))
                          .length > 0 && (
                          <optgroup label="Other Available Admins">
                            {deptAdmins
                              .filter(a => !selectedDepartment || !(a.department || "").toLowerCase().includes(selectedDepartment.toLowerCase()))
                              .sort((a, b) => (a.employee_uav_id || "").localeCompare(b.employee_uav_id || "", undefined, { numeric: true }))
                              .map(a => (
                                <option key={a.id} value={a.id}>
                                  {a.fullname} ({a.employee_uav_id || "Admin"}) {a.department ? `[${a.department}]` : ""}
                                </option>
                              ))}
                          </optgroup>
                        )}
                      </select>
                    )}
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>
                      Optional — links this employee to a specific admin in the department.
                    </p>
                  </div>

                  {/* ── Documents Card ── */}
                  <div style={{
                    background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12,
                    padding: "20px 22px", boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                    display: "flex", flexDirection: "column", gap: 14
                  }}>
                    <div style={{ ...sectionTitle, borderBottom: "1px solid #f1f5f9", paddingBottom: 8, margin: 0 }}>
                      Documents (Drive Links)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={fld}>
                        <label style={lbl}>Valid Proof</label>
                        <input type="url" name="adhar"
                          placeholder="Paste Drive link" style={inp} />
                      </div>
                      <div style={fld}>
                        <label style={lbl}>Address Proof</label>
                        <input type="url" name="addressProof"
                          placeholder="Paste Drive link" style={inp} />
                      </div>
                      <div style={fld}>
                        <label style={lbl}>Police Cert</label>
                        <input type="url" name="police_certificate"
                          placeholder="Paste Drive link" style={inp} />
                      </div>
                      <div style={fld}>
                        <label style={lbl}>Medical Cert</label>
                        <input type="url" name="medical_certificate"
                          placeholder="Paste Drive link" style={inp} />
                      </div>
                      <div style={fld}>
                        <label style={lbl}>Offer Letter</label>
                        <input type="url" name="offer_letter_path"
                          placeholder="Paste Drive link" style={inp} />
                      </div>
                      <div style={fld}>
                        <label style={lbl}>NDA Document</label>
                        <input type="url" name="nda_path"
                          placeholder="Paste Drive link" style={inp} />
                      </div>
                      <div style={{ ...fld, gridColumn: "span 2" }}>
                        <label style={lbl}>HR Docs</label>
                        <input type="url" name="hr_docs_path"
                          placeholder="Paste Drive link" style={inp} />
                      </div>
                    </div>
                  </div>

                  {/* ── Banking & Tax Card ── */}
                  <div style={{
                    background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12,
                    padding: "20px 22px", boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                    display: "flex", flexDirection: "column", gap: 14
                  }}>
                    <div style={{ ...sectionTitle, borderBottom: "1px solid #f1f5f9", paddingBottom: 8, margin: 0 }}>
                      Banking & Tax Details
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={fld}>
                        <label style={lbl}>Account Number</label>
                        <input name="account_number" placeholder="9–18 digits"
                          maxLength={20} pattern="[0-9]{9,18}" style={inp} />
                      </div>
                      <div style={fld}>
                        <label style={lbl}>IFSC Code</label>
                        <input name="ifsc_code" placeholder="e.g. SBIN0001234"
                          style={{ ...inp, textTransform: "uppercase" }} />
                      </div>
                      <div style={fld}>
                        <label style={lbl}>Bank Name</label>
                        <input name="bank_name" placeholder="e.g. State Bank of India" style={inp} />
                      </div>
                      <div style={fld}>
                        <label style={lbl}>Branch Name</label>
                        <input name="branch_name" placeholder="e.g. Main Branch" style={inp} />
                      </div>
                      <div style={{ ...fld, gridColumn: "span 2" }}>
                        <label style={lbl}>PAN Number</label>
                        <input name="pan_number" placeholder="ABCDE1234F"
                          maxLength={10} onChange={handlePanChange}
                          style={{ ...inp, textTransform: "uppercase" }} />
                        {panError && <span style={{ color: "#ef4444", fontSize: 11 }}>{panError}</span>}
                      </div>
                    </div>
                  </div>

                </div>


                {/* ── RIGHT COLUMN ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                  {/* ── Work Experience Card ── */}
                  <div style={{
                    background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12,
                    padding: "20px 22px", boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                    display: "flex", flexDirection: "column", gap: 14
                  }}>
                    <div style={{ ...sectionTitle, borderBottom: "1px solid #f1f5f9", paddingBottom: 8, margin: 0 }}>
                      Work Experience
                    </div>

                    {experiences.map((exp, i) => (
                      <div key={i} style={{
                        background: "#f8fafc", border: "1px solid #e2e8f0",
                        borderRadius: 10, padding: 14, position: "relative",
                      }}>
                        {experiences.length > 1 && (
                          <button type="button" onClick={() => removeExp(i)}
                            style={{
                              position: "absolute", top: 8, right: 8,
                              background: "#fee2e2", border: "none", borderRadius: "50%",
                              width: 22, height: 22, cursor: "pointer",
                              fontSize: 11, color: "#ef4444", fontWeight: 700,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>✕</button>
                        )}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div style={fld}>
                            <label style={lbl}>Organisation</label>
                            <input placeholder="Company name" value={exp.organization}
                              onChange={e => changeExp(i, "organization", e.target.value)} style={inp} />
                          </div>
                          <div style={fld}>
                            <label style={lbl}>Role</label>
                            <input placeholder="Position held" value={exp.role}
                              onChange={e => changeExp(i, "role", e.target.value)} style={inp} />
                          </div>
                          <div style={fld}>
                            <label style={lbl}>From</label>
                            <input type="date" value={exp.from}
                              onChange={e => changeExp(i, "from", e.target.value)} style={inp} />
                          </div>
                          <div style={fld}>
                            <label style={lbl}>To</label>
                            <input type="date" value={exp.to}
                              onChange={e => changeExp(i, "to", e.target.value)} style={inp} />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button type="button" onClick={addExp} style={{
                      padding: "9px 16px", border: "1.5px dashed #cbd5e1",
                      borderRadius: 8, background: "#f8fafc", color: "#2563eb",
                      fontWeight: 700, fontSize: 13, cursor: "pointer",
                      fontFamily: "DM Sans, sans-serif", transition: "all 0.2s"
                    }}>+ Add Experience</button>
                  </div>

                  {/* ── Salary Breakdown Card ── */}
                  <div style={{
                    background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12,
                    padding: "20px 22px", boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                    display: "flex", flexDirection: "column", gap: 14
                  }}>
                    <div style={{ ...sectionTitle, borderBottom: "1px solid #f1f5f9", paddingBottom: 8, margin: 0 }}>
                      Salary Breakdown
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {[
                        { key: "basic_salary", label: "Basic Salary", ph: "e.g. 20000" },
                        { key: "hra", label: "HRA", ph: "e.g. 8000" },
                        { key: "epf_amount", label: "EPF Amount", ph: "e.g. 1800" },
                        { key: "pt_amount", label: "Prof. Tax", ph: "e.g. 200" },
                      ].map(({ key, label, ph }) => (
                        <div key={key} style={fld}>
                          <label style={lbl}>{label}</label>
                          <div style={{
                            display: "flex", alignItems: "center",
                            border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden"
                          }}>
                            <span style={{
                              padding: "10px 12px", background: "#f1f5f9",
                              color: "#64748b", fontWeight: 700, fontSize: 14,
                              borderRight: "1px solid #e2e8f0"
                            }}>₹</span>
                            <input type="number" min="0" placeholder={ph}
                              value={salary[key]}
                              onChange={e => setSalary(p => ({ ...p, [key]: e.target.value }))}
                              style={{ ...inp, border: "none", borderRadius: 0, flex: 1 }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {gross > 0 && (
                      <div style={{
                        background: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
                        border: "1px solid #bbf7d0", borderRadius: 10,
                        padding: "12px 16px", display: "flex",
                        alignItems: "center", gap: 12, flexWrap: "wrap",
                      }}>
                        {[
                          { label: "Gross", val: fmt(gross), color: "#166534" },
                          { label: "EPF + PT", val: fmt(epf + pt), color: "#dc2626", sep: "−" },
                          { label: "Net Pay", val: fmt(net), color: "#0369a1", sep: "=" },
                        ].map(({ label, val, color, sep }) => (
                          <div key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            {sep && <span style={{ color: "#94a3b8", fontWeight: 700 }}>{sep}</span>}
                            <div style={{ textAlign: "center" }}>
                              <div style={{ fontSize: 10, color, fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
                              <div style={{ fontSize: 16, fontWeight: 800, color }}>{val}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}


            <div style={{ display: "flex", gap: 12, marginTop: 28, justifyContent: "flex-end" }}>
              <button type="button" onClick={handleBack} style={{
                padding: "11px 24px", background: "#fff",
                border: "1px solid #e2e8f0", borderRadius: 10,
                fontFamily: "DM Sans,sans-serif", fontWeight: 700,
                fontSize: 14, cursor: "pointer", color: "#475569",
              }}>← Back</button>

              <button type="submit" disabled={readOnly} style={{
                padding: "11px 32px",
                background: readOnly ? "#e2e8f0" : "linear-gradient(135deg,#10b981,#059669)",
                color: readOnly ? "#94a3b8" : "#fff",
                border: "none", borderRadius: 10,
                fontFamily: "DM Sans,sans-serif", fontWeight: 700,
                fontSize: 14, cursor: readOnly ? "not-allowed" : "pointer",
                boxShadow: readOnly ? "none" : "0 4px 12px rgba(16,185,129,0.3)",
              }}>
                {readOnly ? "Read Only Mode" : "✓ Create User"}
              </button>
            </div>
          </>
        )}
      </form>


      {showQr && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
          display: "flex", alignItems: "flex-start", justifyContent: "center",
          zIndex: 9999, backdropFilter: "blur(4px)",
          overflowY: "auto", padding: "20px 0"
        }}>
          <div style={{
            background: "#fff", borderRadius: 20, padding: "36px 32px",
            maxWidth: 440, width: "90%", textAlign: "center",
            boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
            margin: "auto"
          }}>

            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "linear-gradient(135deg,#10b981,#059669)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px", fontSize: 26
            }}>🔐</div>

            <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: "#1e293b" }}>
              Setup Google Authenticator
            </h2>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px" }}>
              Account created successfully ✓
            </p>

            {/* ── Credential Card ── */}
            <div style={{
              background: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
              border: "1.5px solid #86efac", borderRadius: 12,
              padding: "12px 16px", marginBottom: 18, textAlign: "left",
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: "#166534",
                textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8
              }}>
                🎫 Login Credentials
              </div>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 6
              }}>
                <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>Employee ID</span>
                <span style={{
                  fontFamily: "monospace", fontWeight: 800, fontSize: 15,
                  color: "#065f46", background: "#bbf7d0",
                  padding: "3px 10px", borderRadius: 6, letterSpacing: "0.05em"
                }}>{createdInfo.employee_uav_id}</span>
              </div>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>Username</span>
                <span style={{
                  fontFamily: "monospace", fontSize: 12,
                  color: "#1e293b", background: "#f1f5f9",
                  padding: "3px 10px", borderRadius: 6
                }}>{createdInfo.username}</span>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 11, color: "#166534" }}>
                👆 Share the <strong>Employee ID</strong> — this is their login credential.
              </p>
            </div>

            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px" }}>
              Ask them to scan this QR with <strong>Google Authenticator</strong>.
            </p>

            <div style={{
              display: "inline-block", padding: 14, background: "#fff",
              border: "2px solid #e2e8f0", borderRadius: 16,
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)", marginBottom: 20
            }}>
              <img src={qrCode} alt="QR Code"
                style={{ width: 190, height: 190, display: "block" }} />
            </div>

            <div style={{
              background: "#f8fafc", border: "1px solid #e2e8f0",
              borderRadius: 10, padding: "12px 16px", marginBottom: 16, textAlign: "left"
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: "#64748b",
                textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8
              }}>
                Employee steps:
              </div>
              {[
                "Open Google Authenticator on your phone",
                'Tap "+" → "Scan a QR code"',
                "Point camera at the QR code above",
                "A 6-digit code will appear — use it at login",
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 12, color: "#475569" }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                    background: "#10b981", color: "#fff", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700
                  }}>{i + 1}</span>
                  {s}
                </div>
              ))}
            </div>

            <div style={{
              background: "#fef9c3", border: "1px solid #fde68a",
              borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#92400e",
              marginBottom: 20, textAlign: "left", display: "flex", gap: 8
            }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
              <span>QR shown <strong>only once</strong>. Ensure employee scans before closing.</span>
            </div>

            <label style={{
              display: "flex", alignItems: "center", gap: 10,
              cursor: "pointer", marginBottom: 16, fontSize: 13,
              fontWeight: 600, color: "#1e293b", justifyContent: "center"
            }}>
              <input type="checkbox" checked={qrScanned}
                onChange={e => setQrScanned(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "#10b981", cursor: "pointer" }} />
              Employee has scanned the QR code ✓
            </label>

            <button onClick={afterQr} disabled={!qrScanned} style={{
              width: "100%", padding: 13,
              background: qrScanned ? "linear-gradient(135deg,#10b981,#059669)" : "#e2e8f0",
              color: qrScanned ? "#fff" : "#94a3b8",
              border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: qrScanned ? "pointer" : "not-allowed", transition: "all 0.2s",
            }}>
              {qrScanned ? "✅ Done — Close & Continue" : "Check the box to confirm"}
            </button>

            <button onClick={afterQr} style={{
              marginTop: 10, background: "none", border: "none",
              fontSize: 12, color: "#94a3b8", cursor: "pointer", textDecoration: "underline"
            }}>
              Skip (employee will scan on first login)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
