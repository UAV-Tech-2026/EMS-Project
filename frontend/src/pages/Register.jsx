import { useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import "../styles/Register.css";

const API_URL = import.meta.env.VITE_API_URL;

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullname: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "super_admin",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {

    if (!formData.fullname || !formData.fullname.trim()) {
      setError("Full name is required");
      return false;
    }
    if (!formData.username || !formData.username.trim()) {
      setError("Username is required");
      return false;
    }
    if (!formData.email.match(/^[a-zA-Z0-9._%+-]+@uavtech\.ai$/)) {
      setError("Email must be a valid @uavtech.ai address");
      return false;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    return true;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (!validateForm()) return;
    setLoading(true);

    try {

      await axios.post(`${API_URL}/register`, {
        fullname: formData.fullname,
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.msg || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ems-reg-wrapper">
      <div className="ems-reg-box">
        <div className="ems-reg-top">
          <h1>WorkStockPro</h1>
          <p>Enterprise Management System</p>
          <h3>Create Account</h3>
        </div>

        <form onSubmit={handleRegister} className="ems-reg-form">
          <div className="ems-reg-group">
            <label htmlFor="fullname">Full Name</label>
            <input
              id="fullname"
              type="text"
              name="fullname"
              value={formData.fullname}
              onChange={handleInputChange}
              placeholder="Enter your full name"
              required
            />
          </div>

          <div className="ems-reg-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Choose a username"
              required
            />
          </div>

          <div className="ems-reg-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="ems-reg-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter a strong password"
              required
            />
          </div>

          <div className="ems-reg-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="Confirm your password"
              required
            />
          </div>

          <div className="ems-reg-group">
            <label htmlFor="role">Role</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              className="ems-reg-select"
            >
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          {error && <div className="ems-reg-error">{error}</div>}

          <button type="submit" disabled={loading} className="ems-reg-button">
            {loading ? "Creating Account..." : "Register"}
          </button>
        </form>

        <p className="ems-reg-bottom-text">
          Already have an account? <a href="/login">Login here</a>
        </p>
      </div>
    </div>
  );
}
