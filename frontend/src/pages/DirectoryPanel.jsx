import React, { useState, useEffect } from "react";
import { api } from "../utils/api";
import { Search, Users, Briefcase, GraduationCap, Camera, Loader2, CheckCircle, AlertCircle, Shield, Key, Eye, EyeOff, ToggleLeft, ToggleRight } from "lucide-react";
import "../styles/DirectoryPanel.css";

export default function DirectoryPanel({ filterRole = null }) {
  const [people, setPeople]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [filter, setFilter]           = useState("all");
  const [search, setSearch]           = useState("");
  const [uploadingId, setUploadingId] = useState(null);
  const [toast, setToast]             = useState(null);

  // Password reset modal
  const [pwModal, setPwModal]         = useState(null); // { userId, name }
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving]       = useState(false);
  const [showPw, setShowPw]           = useState(false);

  // Status toggle
  const [togglingId, setTogglingId]   = useState(null);

  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  const isSuper = user.role === "super_admin";
  const isHRAdmin = user.role === "admin" && (user.department || "").toLowerCase().includes("hr");
  const canEdit = isSuper || isHRAdmin;

  // Edit Employee Modal State
  const [editModal, setEditModal]     = useState(null);
  const [editForm, setEditForm]       = useState({
    fullname: "", phone: "", email: "", role: "", department: "",
    designation: "", adhar_path: "", address_path: "", account_number: "", pan_number: "",
    basic_salary: 0, hra: 0, epf_amount: 0, pt_amount: 0, police_certificate: "", medical_certificate: "",
    assigned_admin_id: ""
  });
  const [editSaving, setEditSaving]   = useState(false);
  const [departments, setDepartments] = useState([]);
  const [adminsList, setAdminsList]   = useState([]);

  const inp = {
    width: "100%", padding: "10px 14px",
    border: "1px solid #cbd5e1", borderRadius: 8,
    fontSize: 14, fontFamily: "DM Sans, sans-serif",
    outline: "none", boxSizing: "border-box",
    background: "#fff", color: "#1e293b",
  };

  const handleEditClick = async (person) => {
    try {
      const res = await api.get(`/employees/get/${person.id}`);
      setEditForm({
        fullname: res.data.fullname || "",
        phone: res.data.phone || "",
        email: res.data.email || "",
        role: res.data.role || "",
        department: res.data.department || "",
        designation: res.data.designation || "",
        adhar_path: res.data.adhar_path || "",
        address_path: res.data.address_path || "",
        account_number: res.data.account_number || "",
        pan_number: res.data.pan_number || "",
        basic_salary: parseFloat(res.data.basic_salary) || 0,
        hra: parseFloat(res.data.hra) || 0,
        epf_amount: parseFloat(res.data.epf_amount) || 0,
        pt_amount: parseFloat(res.data.pt_amount) || 0,
        police_certificate: res.data.police_certificate || "",
        medical_certificate: res.data.medical_certificate || "",
        assigned_admin_id: res.data.assigned_admin_id || ""
      });
      setEditModal(person.id);

      if (departments.length === 0) {
        const deptRes = await api.get("/meta/departments");
        setDepartments(deptRes.data || []);
      }

      const adminRes = await api.get("/employees/all-assignable");
      const admins = (adminRes.data || []).filter(u => u.role === "admin");
      setAdminsList(admins);
    } catch (err) {
      showToast("error", err.response?.data?.msg || "Failed to fetch employee details");
    }
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editForm.fullname || !editForm.email || !editForm.role || !editForm.department) {
      showToast("error", "Full Name, Email, Role, and Department are required");
      return;
    }
    if (!/^[a-zA-Z0-9._%+-]+@uavtech\.ai$/.test(editForm.email)) {
      showToast("error", "Official email must end with @uavtech.ai");
      return;
    }
    if (editForm.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(editForm.pan_number.toUpperCase())) {
      showToast("error", "Invalid PAN format - expected ABCDE1234F");
      return;
    }

    setEditSaving(true);
    try {
      await api.put(`/employees/edit/${editModal}`, {
        ...editForm,
        pan_number: editForm.pan_number?.toUpperCase()
      });
      showToast("success", "Employee details updated successfully");
      setEditModal(null);
      fetchDirectory();
    } catch (err) {
      showToast("error", err.response?.data?.msg || "Failed to update employee details");
    } finally {
      setEditSaving(false);
    }
  };

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchDirectory = async () => {
    try {
      setLoading(true);
      const res = await api.get("/attendance/directory");
      setPeople(res.data.filter(p => p.role !== "super_admin"));
    } catch (err) {
      console.error("Directory fetch error:", err);
      setError("Failed to load directory. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory();
  }, []);

  useEffect(() => {
    if (filterRole === "employee" || filterRole === "intern" || filterRole === "admin") {
      setFilter(filterRole);
    } else {
      setFilter("all");
    }
    setSearch("");
  }, [filterRole]);

  const handleFileChange = async (e, targetUserId) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast("error", "File too large (Max 2MB)");
      return;
    }
    const formData = new FormData();
    formData.append("profile_pic", file);
    formData.append("target_user_id", targetUserId);
    setUploadingId(targetUserId);
    try {
      await api.post("/employees/upload-profile-pic", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      showToast("success", "Profile photo updated successfully!");
      fetchDirectory();
    } catch (err) {
      showToast("error", "Failed to upload photo");
    } finally {
      setUploadingId(null);
    }
  };

  // ── Password Reset ──
  const handlePasswordReset = async () => {
    if (!newPassword || newPassword.length < 6) {
      showToast("error", "Password must be at least 6 characters");
      return;
    }
    setPwSaving(true);
    try {
      await api.patch(`/employees/reset-password/${pwModal.userId}`, { new_password: newPassword });
      showToast("success", `Password updated for ${pwModal.name}`);
      setPwModal(null);
      setNewPassword("");
      setShowPw(false);
    } catch (err) {
      showToast("error", err.response?.data?.msg || "Failed to reset password");
    } finally {
      setPwSaving(false);
    }
  };

  // ── Active / Deactivate Toggle ──
  const handleToggleStatus = async (p) => {
    const newStatus = p.status?.toLowerCase() === "active" ? "inactive" : "active";
    setTogglingId(p.id);
    try {
      await api.patch(`/employees/status/${p.id}`, { status: newStatus });
      showToast("success", `${p.fullname} marked as ${newStatus}`);
      fetchDirectory();
    } catch (err) {
      showToast("error", err.response?.data?.msg || "Failed to update status");
    } finally {
      setTogglingId(null);
    }
  };

  const empCount     = people.filter(p => p.role === "employee").length;
  const intCount     = people.filter(p => p.role === "intern").length;
  const adminCount   = people.filter(p => p.role === "admin").length;
  const presentCount = people.filter(p => p.present_today === true).length;
  const total        = people.length;

  const filtered = people.filter(p => {
    if (filterRole === "present") {
      if (!p.present_today) return false;
    } else {
      const matchRole =
        filter === "all" ||
        (filter === "employee" && p.role === "employee") ||
        (filter === "intern"   && p.role === "intern") ||
        (filter === "admin"    && p.role === "admin");
      if (!matchRole) return false;
    }
    const q = search.toLowerCase();
    return (
      !q ||
      (p.fullname        || "").toLowerCase().includes(q) ||
      (p.employee_uav_id || "").toLowerCase().includes(q) ||
      (p.designation     || "").toLowerCase().includes(q)
    );
  });

  function initials(name = "") {
    return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  }

  if (loading) return <div className="dp-loading">Loading directory…</div>;
  if (error)   return <div className="dp-error">{error}</div>;

  return (
    <div className="dp-wrap">

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", top: "20px", right: "20px", zIndex: 2000,
          background: toast.type === "success" ? "#dcfce7" : "#fee2e2",
          color: toast.type === "success" ? "#166534" : "#991b1b",
          padding: "12px 20px", borderRadius: "8px", border: "1px solid currentColor",
          display: "flex", alignItems: "center", gap: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          fontSize: "13px", fontWeight: 600
        }}>
          {toast.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ── Password Reset Modal ── */}
      {pwModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)",
          zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(4px)"
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, width: 420, padding: 32,
            boxShadow: "0 20px 40px rgba(0,0,0,0.15)", border: "1px solid #e2e8f0"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Key size={18} color="#7c3aed" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>Reset Password</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{pwModal.name}</div>
              </div>
            </div>

            <div style={{ margin: "20px 0" }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                New Password *
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPw ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, boxSizing: "border-box" }}
                />
                <button
                  onClick={() => setShowPw(p => !p)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0 }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {newPassword.length > 0 && newPassword.length < 6 && (
                <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>Password must be at least 6 characters</div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setPwModal(null); setNewPassword(""); setShowPw(false); }}
                style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordReset}
                disabled={pwSaving || newPassword.length < 6}
                style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: (pwSaving || newPassword.length < 6) ? 0.6 : 1 }}
              >
                {pwSaving ? "Saving…" : "Reset Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Employee Modal ── */}
      {editModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)",
          zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(4px)"
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, width: 720, maxWidth: "90%", padding: 32,
            boxShadow: "0 20px 40px rgba(0,0,0,0.15)", border: "1px solid #e2e8f0",
            maxHeight: "90vh", overflowY: "auto"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Briefcase size={18} color="#2563eb" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>Edit Employee Details</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Update profile, documents, and salary parameters</div>
                </div>
              </div>
              <button 
                onClick={() => setEditModal(null)}
                style={{ background: "none", border: "none", fontSize: 18, color: "#64748b", cursor: "pointer", padding: 0 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSave}>
              {/* Personal & Account Section */}
              <div style={{ fontWeight: 800, fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                Personal & Account
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Full Name *</label>
                  <input
                    type="text"
                    value={editForm.fullname}
                    onChange={e => setEditForm({ ...editForm, fullname: e.target.value })}
                    style={inp}
                    required
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Official Email *</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    style={inp}
                    required
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Phone *</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="+91-XXXXXXXXXX"
                    style={inp}
                    required
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Designation *</label>
                  <input
                    type="text"
                    value={editForm.designation}
                    onChange={e => setEditForm({ ...editForm, designation: e.target.value })}
                    style={inp}
                    required
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Role *</label>
                  <select
                    value={editForm.role}
                    onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                    style={inp}
                    required
                  >
                    <option value="employee">Employee</option>
                    <option value="intern">Intern</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Department *</label>
                  <select
                    value={editForm.department}
                    onChange={e => setEditForm({ ...editForm, department: e.target.value, assigned_admin_id: "" })}
                    style={inp}
                    required
                  >
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 2" }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Assigned Admin</label>
                  <select
                    value={editForm.assigned_admin_id || ""}
                    onChange={e => setEditForm({ ...editForm, assigned_admin_id: e.target.value })}
                    style={inp}
                  >
                    <option value="">— No assigned admin —</option>
                    {adminsList
                      .filter(adm => (adm.department || "").includes(editForm.department))
                      .map(adm => (
                        <option key={adm.id} value={adm.id}>
                          {adm.fullname} ({adm.employee_uav_id || "Admin"})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Documents Section */}
              <div style={{ fontWeight: 800, fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                Documents (Google Drive Links)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Aadhar Proof Link</label>
                  <input
                    type="url"
                    value={editForm.adhar_path}
                    onChange={e => setEditForm({ ...editForm, adhar_path: e.target.value })}
                    style={inp}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Address Proof Link</label>
                  <input
                    type="url"
                    value={editForm.address_path}
                    onChange={e => setEditForm({ ...editForm, address_path: e.target.value })}
                    style={inp}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Police Verification Link</label>
                  <input
                    type="url"
                    value={editForm.police_certificate}
                    onChange={e => setEditForm({ ...editForm, police_certificate: e.target.value })}
                    style={inp}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Medical Certificate Link</label>
                  <input
                    type="url"
                    value={editForm.medical_certificate}
                    onChange={e => setEditForm({ ...editForm, medical_certificate: e.target.value })}
                    style={inp}
                  />
                </div>
              </div>

              {/* Banking & Tax Section */}
              <div style={{ fontWeight: 800, fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                Banking & Tax
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Account Number</label>
                  <input
                    type="text"
                    value={editForm.account_number}
                    onChange={e => setEditForm({ ...editForm, account_number: e.target.value })}
                    style={inp}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>PAN Number</label>
                  <input
                    type="text"
                    value={editForm.pan_number}
                    onChange={e => setEditForm({ ...editForm, pan_number: e.target.value })}
                    maxLength={10}
                    style={inp}
                  />
                </div>
              </div>

              {/* Salary Breakdown Section */}
              <div style={{ fontWeight: 800, fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                Salary Breakdown
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Basic Salary (₹)</label>
                  <input
                    type="number"
                    value={editForm.basic_salary}
                    onChange={e => setEditForm({ ...editForm, basic_salary: parseFloat(e.target.value) || 0 })}
                    style={inp}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>HRA (₹)</label>
                  <input
                    type="number"
                    value={editForm.hra}
                    onChange={e => setEditForm({ ...editForm, hra: parseFloat(e.target.value) || 0 })}
                    style={inp}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>EPF Amount (₹)</label>
                  <input
                    type="number"
                    value={editForm.epf_amount}
                    onChange={e => setEditForm({ ...editForm, epf_amount: parseFloat(e.target.value) || 0 })}
                    style={inp}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Professional Tax (₹)</label>
                  <input
                    type="number"
                    value={editForm.pt_amount}
                    onChange={e => setEditForm({ ...editForm, pt_amount: parseFloat(e.target.value) || 0 })}
                    style={inp}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 10, borderTop: "1px solid #f1f5f9", paddingTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#3b82f6,#2563eb)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: editSaving ? 0.6 : 1 }}
                >
                  {editSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Summary ── */}
      <div className="dp-summary">
        <div className="dp-metric">
          <div className="dp-metric-icon dp-icon-all"><Users size={16} /></div>
          <div>
            <p className="dp-metric-lbl">Total people</p>
            <p className="dp-metric-val">{total}</p>
          </div>
        </div>
        <div className="dp-metric">
          <div className="dp-metric-icon dp-icon-emp"><Briefcase size={16} /></div>
          <div>
            <p className="dp-metric-lbl">Employees</p>
            <p className="dp-metric-val dp-val-emp">{empCount}</p>
          </div>
        </div>
        <div className="dp-metric">
          <div className="dp-metric-icon dp-icon-int"><GraduationCap size={16} /></div>
          <div>
            <p className="dp-metric-lbl">Interns</p>
            <p className="dp-metric-val dp-val-int">{intCount}</p>
          </div>
        </div>
        <div className="dp-metric">
          <div className="dp-metric-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}><Shield size={16} /></div>
          <div>
            <p className="dp-metric-lbl">Admins</p>
            <p className="dp-metric-val" style={{ color: '#0284c7' }}>{adminCount}</p>
          </div>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="dp-controls">
        <div className="dp-search-wrap">
          <Search size={14} className="dp-search-icon" />
          <input
            type="text"
            className="dp-search"
            placeholder="Search by name, ID or department…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {!filterRole && (
          <div className="dp-filters">
            <button className={`dp-filter-btn ${filter === "all" ? "dp-active-all" : ""}`} onClick={() => setFilter("all")}>
              All <span className="dp-badge">{total}</span>
            </button>
            <button className={`dp-filter-btn ${filter === "admin" ? "dp-active-admin" : ""}`} onClick={() => setFilter("admin")}>
              Admins <span className="dp-badge" style={filter === "admin" ? { background: 'rgba(255,255,255,0.2)', color: '#fff' } : { background: '#e0f2fe', color: '#0369a1' }}>{adminCount}</span>
            </button>
            <button className={`dp-filter-btn ${filter === "employee" ? "dp-active-emp" : ""}`} onClick={() => setFilter("employee")}>
              Employees <span className="dp-badge dp-badge-emp">{empCount}</span>
            </button>
            <button className={`dp-filter-btn ${filter === "intern" ? "dp-active-int" : ""}`} onClick={() => setFilter("intern")}>
              Interns <span className="dp-badge dp-badge-int">{intCount}</span>
            </button>
          </div>
        )}

        {filterRole && (
          <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
            {filtered.length} {filterRole === "present" ? "present today" : `${filterRole}s`} found
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="dp-table-wrap">
        {filtered.length === 0 ? (
          <div className="dp-empty">
            {search ? `No results found for "${search}"` : `No ${filterRole === "present" ? "present" : filterRole || ""} records found.`}
          </div>
        ) : (
          <table className="dp-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>ID</th>
                <th>Role</th>
                <th>Designation</th>
                <th>Status</th>
                {canEdit && <th style={{ textAlign: "center" }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const isEmp    = p.role === "employee";
                const isIntern = p.role === "intern";
                const isAdmin  = p.role === "admin";
                const isActive = (p.status || "").toLowerCase() === "active";
                return (
                  <tr key={p.id}>
                    <td className="dp-td-num">{i + 1}</td>
                    <td>
                      <div className="dp-name-cell">
                        <div
                          className={`dp-avatar ${isEmp ? "dp-av-emp" : isIntern ? "dp-av-int" : "dp-av-admin"}`}
                          style={isAdmin ? { background: '#bae6fd', color: '#0369a1' } : {}}
                        >
                          {initials(p.fullname)}
                        </div>
                        <span className="dp-name">{p.fullname || "—"}</span>
                      </div>
                    </td>
                    <td className="dp-td-id">{p.employee_uav_id || "—"}</td>
                    <td>
                      <span
                        className={`dp-pill ${isEmp ? "dp-pill-emp" : isIntern ? "dp-pill-int" : "dp-pill-admin"}`}
                        style={isAdmin ? { background: '#e0f2fe', color: '#0284c7' } : {}}
                      >
                        {isEmp ? "Employee" : isIntern ? "Intern" : "Admin"}
                      </span>
                    </td>
                    <td className="dp-td-dept">{p.designation || "—"}</td>
                    <td>
                      <span className={`dp-status ${isActive ? "dp-status-active" : "dp-status-inactive"}`}>
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {canEdit && (
                      <td>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>

                          {/* Edit details */}
                          <button
                            onClick={() => handleEditClick(p)}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: "4px",
                              padding: "5px 10px", background: "#dbeafe", borderRadius: "6px",
                              fontSize: "11px", fontWeight: 700, color: "#1d4ed8",
                              border: "1px solid #bfdbfe", cursor: "pointer", transition: "all 0.2s"
                            }}
                          >
                            Edit
                          </button>

                          {/* Set Photo */}
                          <label style={{
                            display: "inline-flex", alignItems: "center", gap: "4px",
                            padding: "5px 10px", background: "#f1f5f9", borderRadius: "6px",
                            fontSize: "11px", fontWeight: 700, color: "#475569",
                            cursor: uploadingId === p.id ? "not-allowed" : "pointer",
                            border: "1px solid #e2e8f0", transition: "all 0.2s"
                          }}>
                            {uploadingId === p.id ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
                            {uploadingId === p.id ? "Uploading..." : "Photo"}
                            <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingId === p.id} onChange={(e) => handleFileChange(e, p.id)} />
                          </label>

                          {/* Password Reset + Status Toggle — admin rows only */}
                          {isAdmin && (
                            <>
                              {/* Reset Password */}
                              <button
                                onClick={() => { setPwModal({ userId: p.id, name: p.fullname }); setNewPassword(""); setShowPw(false); }}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: "4px",
                                  padding: "5px 10px", background: "#ede9fe", borderRadius: "6px",
                                  fontSize: "11px", fontWeight: 700, color: "#7c3aed",
                                  border: "1px solid #ddd6fe", cursor: "pointer", transition: "all 0.2s"
                                }}
                              >
                                <Key size={11} /> Password
                              </button>

                              {/* Active / Deactivate Toggle */}
                              <button
                                onClick={() => handleToggleStatus(p)}
                                disabled={togglingId === p.id}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: "4px",
                                  padding: "5px 10px", borderRadius: "6px",
                                  fontSize: "11px", fontWeight: 700, cursor: "pointer",
                                  border: isActive ? "1px solid #fecaca" : "1px solid #bbf7d0",
                                  background: isActive ? "#fee2e2" : "#dcfce7",
                                  color: isActive ? "#b91c1c" : "#15803d",
                                  opacity: togglingId === p.id ? 0.6 : 1,
                                  transition: "all 0.2s"
                                }}
                              >
                                {togglingId === p.id
                                  ? <Loader2 size={11} className="animate-spin" />
                                  : isActive
                                    ? <ToggleRight size={11} />
                                    : <ToggleLeft size={11} />
                                }
                                {togglingId === p.id ? "..." : isActive ? "Deactivate" : "Activate"}
                              </button>
                            </>
                          )}

                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={canEdit ? 7 : 6} className="dp-foot">
                  Showing {filtered.length} of {total} people
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
