import { useState } from "react";
import { authApi } from "../utils/api";
import "../styles/CreateUser.css";
import { useNavigate, useOutletContext } from "react-router-dom";

// Role options per creator
const ROLE_OPTIONS = {
  super_admin: [
    { value: "admin",    label: "Admin"    },
    { value: "employee", label: "Employee" },
    { value: "intern",   label: "Intern"   },
  ],
  admin: [
    { value: "employee", label: "Employee" },
    { value: "intern",   label: "Intern"   },
  ],
};

export default function CreateUser() {
  const navigate       = useNavigate();
  const { user }       = useOutletContext();         // logged-in user
  const allowedRoles   = ROLE_OPTIONS[user?.role] || [];

  const [experiences, setExperiences] = useState([
    { organization: "", role: "", from: "", to: "" },
  ]);

  const [salary, setSalary] = useState({
    basic_salary: "",
    hra:          "",
    epf_amount:   "",
    pt_amount:    "",
  });

  const [emailError, setEmailError] = useState("");

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

  const basic = Number(salary.basic_salary) || 0;
  const hra   = Number(salary.hra)          || 0;
  const epf   = Number(salary.epf_amount)   || 0;
  const pt    = Number(salary.pt_amount)    || 0;
  const gross = basic + hra;
  const net   = gross - epf - pt;
  const fmt   = n => n > 0 ? "₹" + n.toLocaleString("en-IN") : "—";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (emailError) return alert("Please fix the email before submitting");

    const formData = new FormData();
    formData.append("fullname",    e.target.fullname.value);
    formData.append("phone",       e.target.phone.value);
    formData.append("email",       e.target.email.value);
    formData.append("altEmail",    e.target.altEmail.value);
    formData.append("designation", e.target.designation.value);
    formData.append("password",    e.target.password.value);
    formData.append("role",        e.target.role.value);
    formData.append("experiences", JSON.stringify(experiences));
    formData.append("basic_salary", salary.basic_salary || 0);
    formData.append("hra",          salary.hra          || 0);
    formData.append("epf_amount",   salary.epf_amount   || 0);
    formData.append("pt_amount",    salary.pt_amount    || 0);

    if (e.target.adhar.files[0])
      formData.append("adhar", e.target.adhar.files[0]);
    if (e.target.addressProof.files[0])
      formData.append("addressProof", e.target.addressProof.files[0]);

    try {
      await authApi.post("/create-user", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("User Created Successfully!");
      // Redirect based on who created
      navigate(user?.role === "super_admin"
        ? "/super-admin-dashboard"
        : "/admin-dashboard"
      );
    } catch (err) {
      const msg = err.response?.data?.msg || "Error creating user";
      alert(`Error: ${msg}`);
    }
  };

  return (
    <div className="create-user-wrapper">
      <div className="title-section">
        <h1>Create {user?.role === "super_admin" ? "Admin / Employee" : "Employee / Intern"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="create-form">
        <div className="form-columns">
          <div className="left-column">
            <input name="fullname"    placeholder="Full Name"              required />
            <input name="phone"       placeholder="+91-XXXXXXXXXX"
                   pattern="\+91-[0-9]{10}"                                required />
            <input name="email"       placeholder="Official Email (@uavtech.ai)"
                   onChange={handleEmailChange}                             required />
            {emailError && <div className="error-msg">{emailError}</div>}
            <input name="altEmail"    type="email" placeholder="Alternate Email" />
            <input name="designation" placeholder="Designation"            required />

            {/* ── ROLE DROPDOWN — filtered by creator's role ── */}
            <select name="role" required>
              <option value="">Select Role</option>
              {allowedRoles.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <input name="password" type="password" placeholder="Password" required />
          </div>

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
                { key: "hra",          label: "HRA",           placeholder: "e.g. 8000"  },
                { key: "epf_amount",   label: "EPF Amount",    placeholder: "e.g. 1800"  },
                { key: "pt_amount",    label: "Prof. Tax (PT)",placeholder: "e.g. 200"   },
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

            <label className="doc-label">Valid Proof</label>
            <input type="file" name="adhar" className="file-input" />
            <label className="doc-label">Address Proof</label>
            <input type="file" name="addressProof" className="file-input" />
          </div>
        </div>

        <div className="form-buttons">
          <button type="submit" className="submit-btn">Create User</button>
          <button type="button" className="back-btn"
            onClick={() => navigate(user?.role === "super_admin"
              ? "/super-admin-dashboard"
              : "/admin-dashboard")}>
            Back to Dashboard
          </button>
        </div>
      </form>
    </div>
  );
}