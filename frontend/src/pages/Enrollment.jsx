import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/Enrollment.css";

const API_URL = import.meta.env.VITE_API_URL;

export default function AdminEnrollment() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", father_name: "", email: "", alt_email: "",
    phone: "", password: "", designation: "", role: "",
  });

  const [experiences, setExperiences] = useState([{ organization: "", role: "", from: "", to: "" }]);
  const [adharFile, setAdharFile] = useState(null);
  const [addressFile, setAddressFile] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleExpChange = (index, e) => {
    const newExps = [...experiences];
    newExps[index][e.target.name] = e.target.value;
    setExperiences(newExps);
  };

  const addExperience = () => {
    setExperiences([...experiences, { organization: "", role: "", from: "", to: "" }]);
  };

  const validateForm = () => {
    const phoneRegex = /^\+91-[0-9]{10}$/;
    if (!phoneRegex.test(form.phone)) {
      setError("Phone must be in format: +91-XXXXXXXXXX");
      return false;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@uavtech\.ai$/;
    if (!emailRegex.test(form.email)) {
      setError("Official email must end with @uavtech.ai");
      return false;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.name || !form.email || !form.phone || !form.password || !form.role) {
      setError("Please fill all required fields");
      return;
    }

    if (!validateForm()) return;

    try {
      const payload = {
        ...form,
        experiences: JSON.stringify(experiences),
        aadhar_proof: adharFile,
        address_proof: addressFile,
      };

      await axios.post(`${API_URL}/employees/enroll`, payload, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      setSuccess(`Employee Enrolled successfully! Redirecting...`);
      setTimeout(() => navigate("/admin-dashboard"), 2000);

    } catch (err) {
      setError(err.response?.data?.msg || err.response?.data?.message || "Enrollment failed");
    }
  };

  return (
    <div className="enrol-page-wrapper">
      <div className="enrol-form-card">
        <header className="enrol-header">
          <h2>Admin Employee Enrollment</h2>
          <p>Register new staff members into the system</p>
        </header>

        {error && <div className="enrol-alert enrol-error">{error}</div>}
        {success && <div className="enrol-alert enrol-success">{success}</div>}

        <form className="enrol-form" onSubmit={handleSubmit}>
          <div className="enrol-grid">
            <input name="name" placeholder="Full Name" onChange={handleChange} required />
            <input name="father_name" placeholder="Father Name" onChange={handleChange} />

            <input
              name="phone"
              placeholder="+91-XXXXXXXXXX"
              title="Example: +91-9876543210"
              onChange={handleChange}
              required
            />
            <input
              name="email"
              placeholder="Official Email (@uavtech.ai)"
              onChange={handleChange}
              required
            />
            <input name="alt_email" placeholder="Alternate Email" type="email" onChange={handleChange} />
            <input name="designation" placeholder="Designation" onChange={handleChange} />

            <select name="role" value={form.role} onChange={handleChange} required>
              <option value="">Select Role</option>
              <option value="employee">Employee</option>
              <option value="intern">Intern</option>
            </select>

            <input type="password" name="password" placeholder="Password (Min 6 chars)" onChange={handleChange} required />
          </div>

          <section className="enrol-section">
            <h4>Work Experience</h4>
            {experiences.map((exp, index) => (
              <div key={index} className="enrol-exp-row">
                <input name="organization" placeholder="Organization" onChange={(e) => handleExpChange(index, e)} />
                <input name="role" placeholder="Role" onChange={(e) => handleExpChange(index, e)} />
                <div className="enrol-date-group">
                  <label>From:</label>
                  <input name="from" type="date" onChange={(e) => handleExpChange(index, e)} />
                </div>
                <div className="enrol-date-group">
                  <label>To:</label>
                  <input name="to" type="date" onChange={(e) => handleExpChange(index, e)} />
                </div>
              </div>
            ))}
            <button type="button" className="enrol-btn-secondary" onClick={addExperience}>
              + Add Experience
            </button>
          </section>

          <section className="enrol-section">
            <h4>Documents (Drive Links)</h4>
            <div className="enrol-file-grid">
              <div className="enrol-file-input">
                <label>Valid Proof (Google Drive Link)</label>
                <input type="url" placeholder="Paste link here" onChange={(e) => setAdharFile(e.target.value)} />
              </div>
              <div className="enrol-file-input">
                <label>Address Proof (Google Drive Link)</label>
                <input type="url" placeholder="Paste link here" onChange={(e) => setAddressFile(e.target.value)} />
              </div>
            </div>
          </section>

          <button type="submit" className="enrol-btn-primary">Enroll Employee</button>
        </form>
      </div>
    </div>
  );
}
