import React, { useState, useEffect } from "react";
import { api } from "../utils/api";
import {
  Search, Users, Briefcase, GraduationCap, Camera, Loader2, CheckCircle,
  AlertCircle, Shield, Key, Eye, EyeOff, ToggleLeft, ToggleRight,
  Plus, Trash2, SlidersHorizontal, PlusCircle, X, Building, DollarSign,
  CreditCard, FileText, ChevronDown, Check
} from "lucide-react";
import "../styles/DirectoryPanel.css";

export default function DirectoryPanel({ filterRole = null }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [uploadingId, setUploadingId] = useState(null);
  const [toast, setToast] = useState(null);

  // Password reset modal
  const [pwModal, setPwModal] = useState(null); // { userId, name }
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // Status toggle
  const [togglingId, setTogglingId] = useState(null);

  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  const isSuper = user.role === "super_admin";
  const isHRAdmin = user.role === "admin" && (user.department || "").toLowerCase().includes("hr");
  const canEdit = isSuper || isHRAdmin;

  // Custom Field Definitions (Global)
  const [customFieldDefs, setCustomFieldDefs] = useState([]);
  const [customSettingsOpen, setCustomSettingsOpen] = useState(false);
  const [newFieldForm, setNewFieldForm] = useState({
    section: "bank_tax",
    label: "",
    field_type: "text",
  });
  const [fieldActionLoading, setFieldActionLoading] = useState(false);

  // Edit Employee Modal State
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "Mr.", fullname: "", phone: "", email: "", role: "", department: "",
    designation: "", adhar_path: "", address_path: "", account_number: "", ifsc_code: "", bank_name: "", branch_name: "", pan_number: "",
    basic_salary: 0, hra: 0, epf_amount: 0, pt_amount: 0, police_certificate: "", medical_certificate: "",
    offer_letter_path: "", nda_path: "", hr_docs_path: "", assigned_admin_id: "",
    experiences: [],
    custom_fields: {},
    custom_salary_components: [],
    custom_bank_fields: []
  });
  const [editSaving, setEditSaving] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [adminsList, setAdminsList] = useState([]);

  const inp = {
    width: "100%", padding: "10px 14px",
    border: "1px solid #cbd5e1", borderRadius: 8,
    fontSize: 14, fontFamily: "DM Sans, sans-serif",
    outline: "none", boxSizing: "border-box",
    background: "#fff", color: "#1e293b",
  };

  const fetchCustomFieldDefs = async () => {
    try {
      const res = await api.get("/meta/custom-fields");
      setCustomFieldDefs(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load custom field definitions:", err);
    }
  };

  const handleCreateCustomField = async (e) => {
    e.preventDefault();
    if (!newFieldForm.label.trim()) {
      showToast("error", "Field Label is required");
      return;
    }
    setFieldActionLoading(true);
    try {
      await api.post("/meta/custom-fields", newFieldForm);
      showToast("success", `Custom field "${newFieldForm.label}" created`);
      setNewFieldForm({ section: "bank_tax", label: "", field_type: "text" });
      await fetchCustomFieldDefs();
    } catch (err) {
      showToast("error", err.response?.data?.msg || "Failed to create custom field");
    } finally {
      setFieldActionLoading(false);
    }
  };

  const handleDeleteCustomField = async (id, label) => {
    if (!window.confirm(`Are you sure you want to delete custom field "${label}"?`)) return;
    try {
      await api.delete(`/meta/custom-fields/${id}`);
      showToast("success", `Custom field "${label}" deleted`);
      await fetchCustomFieldDefs();
    } catch (err) {
      showToast("error", err.response?.data?.msg || "Failed to delete custom field");
    }
  };

  const handleEditClick = async (person) => {
    try {
      const res = await api.get(`/employees/get/${person.id}`);
      const rawExp = Array.isArray(res.data.experiences) ? res.data.experiences : [];
      const rawCust = (res.data.custom_fields && typeof res.data.custom_fields === "object") ? res.data.custom_fields : {};

      const customSal = Array.isArray(rawCust._custom_salary) ? rawCust._custom_salary : [];
      const customBank = Array.isArray(rawCust._custom_bank) ? rawCust._custom_bank : [];

      setEditForm({
        title: res.data.title || "Mr.",
        fullname: res.data.fullname || "",
        phone: res.data.phone || "",
        email: res.data.email || "",
        role: res.data.role || "",
        department: res.data.department || "",
        designation: res.data.designation || "",
        adhar_path: res.data.adhar_path || "",
        address_path: res.data.address_path || "",
        account_number: res.data.account_number || "",
        ifsc_code: res.data.ifsc_code || "",
        bank_name: res.data.bank_name || "",
        branch_name: res.data.branch_name || "",
        pan_number: res.data.pan_number || "",
        basic_salary: parseFloat(res.data.basic_salary) || 0,
        hra: parseFloat(res.data.hra) || 0,
        epf_amount: parseFloat(res.data.epf_amount) || 0,
        pt_amount: parseFloat(res.data.pt_amount) || 0,
        police_certificate: res.data.police_certificate || "",
        medical_certificate: res.data.medical_certificate || "",
        offer_letter_path: res.data.offer_letter_path || "",
        nda_path: res.data.nda_path || "",
        hr_docs_path: res.data.hr_docs_path || "",
        assigned_admin_id: res.data.assigned_admin_id ? String(res.data.assigned_admin_id) : "",
        experiences: rawExp.length > 0 ? rawExp : [],
        custom_fields: rawCust,
        custom_salary_components: customSal,
        custom_bank_fields: customBank
      });
      setEditModal(person.id);

      if (departments.length === 0) {
        const deptRes = await api.get("/meta/departments");
        setDepartments(deptRes.data || []);
      }

      const adminRes = await api.get("/employees/all-assignable");
      const admins = (adminRes.data || []).filter(u => u.role === "admin" || u.role === "super_admin");
      setAdminsList(admins);

      fetchCustomFieldDefs();
    } catch (err) {
      showToast("error", err.response?.data?.msg || "Failed to fetch employee details");
    }
  };

  // ── Work Experience Helpers ──
  const handleAddExperience = () => {
    setEditForm(prev => ({
      ...prev,
      experiences: [...prev.experiences, { organization: "", role: "", from: "", to: "" }]
    }));
  };

  const handleRemoveExperience = (idx) => {
    setEditForm(prev => ({
      ...prev,
      experiences: prev.experiences.filter((_, i) => i !== idx)
    }));
  };

  const handleExperienceChange = (idx, field, val) => {
    setEditForm(prev => {
      const copy = [...prev.experiences];
      copy[idx] = { ...copy[idx], [field]: val };
      return { ...prev, experiences: copy };
    });
  };

  // ── Dynamic Bank & Tax Custom Fields ──
  const handleAddCustomBankField = () => {
    setEditForm(prev => ({
      ...prev,
      custom_bank_fields: [...prev.custom_bank_fields, { label: "", value: "" }]
    }));
  };

  const handleRemoveCustomBankField = (idx) => {
    setEditForm(prev => ({
      ...prev,
      custom_bank_fields: prev.custom_bank_fields.filter((_, i) => i !== idx)
    }));
  };

  const handleCustomBankChange = (idx, field, val) => {
    setEditForm(prev => {
      const copy = [...prev.custom_bank_fields];
      copy[idx] = { ...copy[idx], [field]: val };
      return { ...prev, custom_bank_fields: copy };
    });
  };

  // ── Dynamic Salary Breakdown Custom Fields ──
  const handleAddCustomSalaryComp = () => {
    setEditForm(prev => ({
      ...prev,
      custom_salary_components: [
        ...prev.custom_salary_components,
        { label: "", type: "allowance", amount: 0 }
      ]
    }));
  };

  const handleRemoveCustomSalaryComp = (idx) => {
    setEditForm(prev => ({
      ...prev,
      custom_salary_components: prev.custom_salary_components.filter((_, i) => i !== idx)
    }));
  };

  const handleCustomSalaryChange = (idx, field, val) => {
    setEditForm(prev => {
      const copy = [...prev.custom_salary_components];
      copy[idx] = { ...copy[idx], [field]: val };
      return { ...prev, custom_salary_components: copy };
    });
  };

  // ── Global Custom Field Value Change ──
  const handleGlobalCustomFieldChange = (key, val) => {
    setEditForm(prev => ({
      ...prev,
      custom_fields: {
        ...prev.custom_fields,
        [key]: val
      }
    }));
  };

  // ── Computed Salary Breakdown Totals ──
  const calcBasic = parseFloat(editForm.basic_salary) || 0;
  const calcHra = parseFloat(editForm.hra) || 0;
  const calcEpf = parseFloat(editForm.epf_amount) || 0;
  const calcPt = parseFloat(editForm.pt_amount) || 0;

  const customAllowances = (editForm.custom_salary_components || [])
    .filter(c => c.type === "allowance")
    .reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

  const customDeductions = (editForm.custom_salary_components || [])
    .filter(c => c.type === "deduction")
    .reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

  const totalGross = calcBasic + calcHra + customAllowances;
  const totalDeductions = calcEpf + calcPt + customDeductions;
  const totalNet = Math.max(0, totalGross - totalDeductions);

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
      const mergedCustomFields = {
        ...editForm.custom_fields,
        _custom_salary: editForm.custom_salary_components.filter(c => c.label.trim()),
        _custom_bank: editForm.custom_bank_fields.filter(b => b.label.trim())
      };

      const cleanedExperiences = editForm.experiences.filter(
        exp => exp.organization.trim() || exp.role.trim() || exp.from || exp.to
      );

      await api.put(`/employees/edit/${editModal}`, {
        ...editForm,
        pan_number: editForm.pan_number?.toUpperCase(),
        experiences: cleanedExperiences,
        custom_fields: mergedCustomFields
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
    setTimeout(() => setToast(null), 3500);
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
    fetchCustomFieldDefs();
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

  const empCount = people.filter(p => p.role === "employee").length;
  const intCount = people.filter(p => p.role === "intern").length;
  const adminCount = people.filter(p => p.role === "admin").length;
  const presentCount = people.filter(p => p.present_today === true).length;
  const total = people.length;

  const filtered = people.filter(p => {
    if (filterRole === "present") {
      if (!p.present_today) return false;
    } else {
      const matchRole =
        filter === "all" ||
        (filter === "employee" && p.role === "employee") ||
        (filter === "intern" && p.role === "intern") ||
        (filter === "admin" && p.role === "admin");
      if (!matchRole) return false;
    }
    const q = search.toLowerCase();
    return (
      !q ||
      (p.fullname || "").toLowerCase().includes(q) ||
      (p.employee_uav_id || "").toLowerCase().includes(q) ||
      (p.designation || "").toLowerCase().includes(q)
    );
  });

  function initials(name = "") {
    return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  }

  // Matching admins vs other admins
  const deptAdmins = adminsList.filter(adm =>
    editForm.department && (adm.department || "").toLowerCase().includes(editForm.department.toLowerCase())
  );
  const otherAdmins = adminsList.filter(adm =>
    !editForm.department || !(adm.department || "").toLowerCase().includes(editForm.department.toLowerCase())
  );

  if (loading) return <div className="dp-loading">Loading directory…</div>;
  if (error) return <div className="dp-error">{error}</div>;

  return (
    <div className="dp-wrap">

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", top: "20px", right: "20px", zIndex: 2200,
          background: toast.type === "success" ? "#dcfce7" : "#fee2e2",
          color: toast.type === "success" ? "#166534" : "#991b1b",
          padding: "12px 20px", borderRadius: "8px", border: "1px solid currentColor",
          display: "flex", alignItems: "center", gap: "10px", boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
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

      {/* ── Custom Field Settings Modal (HR Admin & Super Admin Only) ── */}
      {customSettingsOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)",
          zIndex: 1600, display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(5px)"
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, width: 680, maxWidth: "92%", padding: 28,
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", border: "1px solid #cbd5e1",
            maxHeight: "88vh", overflowY: "auto"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "#f3e8ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <SlidersHorizontal size={18} color="#9333ea" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>Directory Custom Field Settings</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Manage custom fields for employee profiles, banking & salary</div>
                </div>
              </div>
              <button
                onClick={() => setCustomSettingsOpen(false)}
                style={{ background: "none", border: "none", fontSize: 18, color: "#64748b", cursor: "pointer", padding: 4 }}
              >
                ✕
              </button>
            </div>

            {/* Form to add a new custom field */}
            <form onSubmit={handleCreateCustomField} style={{
              background: "#f8fafc", padding: "16px", borderRadius: 12,
              border: "1px solid #e2e8f0", marginBottom: 24
            }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#334155", textTransform: "uppercase", marginBottom: 12 }}>
                + Add New Custom Field Definition
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.5fr 1fr auto", gap: 10, alignItems: "flex-end" }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>
                    Section
                  </label>
                  <select
                    value={newFieldForm.section}
                    onChange={e => setNewFieldForm({ ...newFieldForm, section: e.target.value })}
                    style={{ ...inp, padding: "8px 10px", fontSize: 13 }}
                  >
                    <option value="bank_tax">Banking & Tax</option>
                    <option value="salary">Salary Breakdown</option>
                    <option value="personal">Personal & Account</option>
                    <option value="docs">Documents</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>
                    Field Label *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPI ID, PF UAN"
                    value={newFieldForm.label}
                    onChange={e => setNewFieldForm({ ...newFieldForm, label: e.target.value })}
                    style={{ ...inp, padding: "8px 10px", fontSize: 13 }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>
                    Field Type
                  </label>
                  <select
                    value={newFieldForm.field_type}
                    onChange={e => setNewFieldForm({ ...newFieldForm, field_type: e.target.value })}
                    style={{ ...inp, padding: "8px 10px", fontSize: 13 }}
                  >
                    <option value="text">Text</option>
                    <option value="number">Number (₹)</option>
                    <option value="date">Date</option>
                    <option value="url">URL Link</option>
                  </select>
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={fieldActionLoading}
                    style={{
                      padding: "8px 14px", borderRadius: 8, border: "none",
                      background: "linear-gradient(135deg,#9333ea,#7c3aed)", color: "#fff",
                      fontWeight: 700, fontSize: 12, cursor: "pointer", height: 38,
                      display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap"
                    }}
                  >
                    <Plus size={14} /> Add Field
                  </button>
                </div>
              </div>
            </form>

            {/* List of existing custom fields */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                Existing Custom Fields ({customFieldDefs.length})
              </div>

              {customFieldDefs.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: 13, background: "#f8fafc", borderRadius: 8, border: "1px dashed #cbd5e1" }}>
                  No custom fields defined yet. Add custom fields above to appear across all employee records.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {customFieldDefs.map(fld => {
                    const sectionLabel =
                      fld.section === "bank_tax" ? "Banking & Tax" :
                      fld.section === "salary" ? "Salary Breakdown" :
                      fld.section === "personal" ? "Personal & Account" : "Documents";

                    return (
                      <div key={fld.id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "10px 14px", borderRadius: 8, background: "#fff",
                        border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                            padding: "3px 8px", borderRadius: 4,
                            background: fld.section === "bank_tax" ? "#ecfdf5" : fld.section === "salary" ? "#eff6ff" : "#fdf4ff",
                            color: fld.section === "bank_tax" ? "#059669" : fld.section === "salary" ? "#2563eb" : "#c026d3",
                          }}>
                            {sectionLabel}
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>{fld.label}</div>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>key: <code>{fld.field_key}</code> • type: {fld.field_type}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomField(fld.id, fld.label)}
                          style={{
                            padding: "5px 10px", background: "#fee2e2", border: "1px solid #fecaca",
                            borderRadius: 6, color: "#dc2626", cursor: "pointer", fontSize: 11,
                            fontWeight: 700, display: "flex", alignItems: "center", gap: 4
                          }}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20, borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
              <button
                type="button"
                onClick={() => setCustomSettingsOpen(false)}
                style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#475569", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                Close Settings
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
            background: "#fff", borderRadius: 16, width: 780, maxWidth: "94%", padding: 32,
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
                  <div style={{ fontSize: 12, color: "#64748b" }}>Update profile, experience, documents, and salary parameters</div>
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
              {/* 1. Personal & Account Section */}
              <div style={{ fontWeight: 800, fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                Personal & Account Details
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Title & Full Name *</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select
                      value={editForm.title || "Mr."}
                      onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                      style={{ ...inp, width: 90, flexShrink: 0 }}
                    >
                      <option value="Mr.">Mr.</option>
                      <option value="Mrs.">Mrs.</option>
                      <option value="Ms.">Ms.</option>
                      <option value="Dr.">Dr.</option>
                    </select>
                    <input
                      type="text"
                      value={editForm.fullname}
                      onChange={e => setEditForm({ ...editForm, fullname: e.target.value })}
                      style={inp}
                      placeholder="Full Name"
                      required
                    />
                  </div>
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
                    onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                    style={inp}
                    required
                  >
                    <option value="">— N/A —</option>
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Assigned Admin Selection */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 2" }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Assigned Admin (Select or Change Admin)
                  </label>
                  <select
                    value={editForm.assigned_admin_id || ""}
                    onChange={e => setEditForm({ ...editForm, assigned_admin_id: e.target.value })}
                    style={inp}
                  >
                    <option value="">— N/A —</option>
                    {adminsList.map(adm => {
                      const roleLower = (adm.role || "").toLowerCase();
                      const isAdmin = roleLower === "admin" || roleLower === "super_admin";
                      const dept = adm.department ? (adm.department.startsWith("Admin-") ? adm.department : `Admin-${adm.department}`) : "Admin";
                      const uavId = adm.employee_uav_id ? ` (${adm.employee_uav_id})` : "";
                      return (
                        <option key={adm.id} value={String(adm.id)}>
                          {isAdmin ? `${dept}${uavId}` : `${adm.fullname}${uavId}`}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Global Custom Fields for Personal & Account Section */}
                {customFieldDefs.filter(f => f.section === "personal").map(fld => (
                  <div key={fld.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      {fld.label}
                    </label>
                    <input
                      type={fld.field_type === "number" ? "number" : fld.field_type === "date" ? "date" : fld.field_type === "url" ? "url" : "text"}
                      value={editForm.custom_fields[fld.field_key] || ""}
                      onChange={e => handleGlobalCustomFieldChange(fld.field_key, e.target.value)}
                      style={inp}
                    />
                  </div>
                ))}
              </div>

              {/* 2. Work Experience Section */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                <div style={{ fontWeight: 800, fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Work Experience
                </div>
                <button
                  type="button"
                  onClick={handleAddExperience}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "4px",
                    padding: "4px 10px", background: "#f0fdf4", border: "1px solid #bbf7d0",
                    borderRadius: "6px", fontSize: "11px", fontWeight: 700, color: "#166534",
                    cursor: "pointer"
                  }}
                >
                  <Plus size={12} /> Add Experience
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                {editForm.experiences.length === 0 ? (
                  <div style={{ padding: "14px", background: "#f8fafc", borderRadius: 8, border: "1px dashed #cbd5e1", fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
                    No work experience recorded. Click <strong>+ Add Experience</strong> to add prior organization history.
                  </div>
                ) : (
                  editForm.experiences.map((exp, idx) => (
                    <div key={idx} style={{
                      display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1fr 1fr auto", gap: 8,
                      padding: "10px 12px", background: "#f8fafc", border: "1px solid #e2e8f0",
                      borderRadius: 8, alignItems: "center"
                    }}>
                      <div>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>
                          Organization
                        </label>
                        <input
                          type="text"
                          placeholder="Company name"
                          value={exp.organization || ""}
                          onChange={e => handleExperienceChange(idx, "organization", e.target.value)}
                          style={{ ...inp, padding: "6px 8px", fontSize: 12 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>
                          Role / Title
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Software Engineer"
                          value={exp.role || ""}
                          onChange={e => handleExperienceChange(idx, "role", e.target.value)}
                          style={{ ...inp, padding: "6px 8px", fontSize: 12 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>
                          From Date
                        </label>
                        <input
                          type="date"
                          value={exp.from || ""}
                          onChange={e => handleExperienceChange(idx, "from", e.target.value)}
                          style={{ ...inp, padding: "6px 8px", fontSize: 12 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>
                          To Date
                        </label>
                        <input
                          type="date"
                          value={exp.to || ""}
                          onChange={e => handleExperienceChange(idx, "to", e.target.value)}
                          style={{ ...inp, padding: "6px 8px", fontSize: 12 }}
                        />
                      </div>
                      <div style={{ paddingTop: 14 }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveExperience(idx)}
                          style={{
                            padding: "6px", background: "#fee2e2", border: "1px solid #fecaca",
                            borderRadius: 6, color: "#dc2626", cursor: "pointer", display: "flex",
                            alignItems: "center", justifyContent: "center"
                          }}
                          title="Remove experience"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 3. Banking & Tax Section */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                <div style={{ fontWeight: 800, fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Banking & Tax Details
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomBankField}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "4px",
                    padding: "4px 10px", background: "#eff6ff", border: "1px solid #bfdbfe",
                    borderRadius: "6px", fontSize: "11px", fontWeight: 700, color: "#1d4ed8",
                    cursor: "pointer"
                  }}
                >
                  <Plus size={12} /> Add Bank/Tax Field
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
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
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>IFSC Code</label>
                  <input
                    type="text"
                    value={editForm.ifsc_code}
                    onChange={e => setEditForm({ ...editForm, ifsc_code: e.target.value.toUpperCase() })}
                    placeholder="e.g. SBIN0001234"
                    style={{ ...inp, textTransform: "uppercase" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Bank Name</label>
                  <input
                    type="text"
                    value={editForm.bank_name}
                    onChange={e => setEditForm({ ...editForm, bank_name: e.target.value })}
                    placeholder="e.g. State Bank of India"
                    style={inp}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Branch Name</label>
                  <input
                    type="text"
                    value={editForm.branch_name}
                    onChange={e => setEditForm({ ...editForm, branch_name: e.target.value })}
                    placeholder="e.g. Main Branch"
                    style={inp}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 2" }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>PAN Number</label>
                  <input
                    type="text"
                    value={editForm.pan_number}
                    onChange={e => setEditForm({ ...editForm, pan_number: e.target.value.toUpperCase() })}
                    maxLength={10}
                    style={{ ...inp, textTransform: "uppercase" }}
                  />
                </div>

                {/* Global Custom Fields for Banking & Tax */}
                {customFieldDefs.filter(f => f.section === "bank_tax").map(fld => (
                  <div key={fld.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      {fld.label}
                    </label>
                    <input
                      type={fld.field_type === "number" ? "number" : fld.field_type === "date" ? "date" : fld.field_type === "url" ? "url" : "text"}
                      value={editForm.custom_fields[fld.field_key] || ""}
                      onChange={e => handleGlobalCustomFieldChange(fld.field_key, e.target.value)}
                      style={inp}
                      placeholder={`Enter ${fld.label}`}
                    />
                  </div>
                ))}
              </div>

              {/* Dynamic Ad-hoc Bank/Tax Fields */}
              {editForm.custom_bank_fields.length > 0 && (
                <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>
                    Additional Bank/Tax Fields
                  </div>
                  {editForm.custom_bank_fields.map((bf, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr auto", gap: 8, alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="Field Name (e.g. UPI ID)"
                        value={bf.label}
                        onChange={e => handleCustomBankChange(idx, "label", e.target.value)}
                        style={{ ...inp, padding: "8px 10px", fontSize: 13 }}
                      />
                      <input
                        type="text"
                        placeholder="Value"
                        value={bf.value}
                        onChange={e => handleCustomBankChange(idx, "value", e.target.value)}
                        style={{ ...inp, padding: "8px 10px", fontSize: 13 }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomBankField(idx)}
                        style={{
                          padding: "8px", background: "#fee2e2", border: "1px solid #fecaca",
                          borderRadius: 6, color: "#dc2626", cursor: "pointer"
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 4. Salary Breakdown Section */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                <div style={{ fontWeight: 800, fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Salary Breakdown & Parameters
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomSalaryComp}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "4px",
                    padding: "4px 10px", background: "#f5f3ff", border: "1px solid #ddd6fe",
                    borderRadius: "6px", fontSize: "11px", fontWeight: 700, color: "#6d28d9",
                    cursor: "pointer"
                  }}
                >
                  <Plus size={12} /> Add Salary Field
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
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

                {/* Global Custom Fields for Salary Breakdown */}
                {customFieldDefs.filter(f => f.section === "salary").map(fld => (
                  <div key={fld.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      {fld.label} (₹)
                    </label>
                    <input
                      type={fld.field_type === "number" ? "number" : "text"}
                      value={editForm.custom_fields[fld.field_key] || ""}
                      onChange={e => handleGlobalCustomFieldChange(fld.field_key, e.target.value)}
                      style={inp}
                      placeholder="e.g. 2000"
                    />
                  </div>
                ))}
              </div>

              {/* Dynamic Ad-hoc Salary Components */}
              {editForm.custom_salary_components.length > 0 && (
                <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>
                    Additional Salary Components
                  </div>
                  {editForm.custom_salary_components.map((sc, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1.5fr auto", gap: 8, alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="Component Name (e.g. Special Allowance)"
                        value={sc.label}
                        onChange={e => handleCustomSalaryChange(idx, "label", e.target.value)}
                        style={{ ...inp, padding: "8px 10px", fontSize: 13 }}
                      />
                      <select
                        value={sc.type || "allowance"}
                        onChange={e => handleCustomSalaryChange(idx, "type", e.target.value)}
                        style={{ ...inp, padding: "8px 10px", fontSize: 13 }}
                      >
                        <option value="allowance">+ Allowance</option>
                        <option value="deduction">- Deduction</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Amount (₹)"
                        value={sc.amount}
                        onChange={e => handleCustomSalaryChange(idx, "amount", parseFloat(e.target.value) || 0)}
                        style={{ ...inp, padding: "8px 10px", fontSize: 13 }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomSalaryComp(idx)}
                        style={{
                          padding: "8px", background: "#fee2e2", border: "1px solid #fecaca",
                          borderRadius: 6, color: "#dc2626", cursor: "pointer"
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Salary Summary Card */}
              <div style={{
                background: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
                border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 16px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 20
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>Estimated Gross Salary</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#14532d" }}>₹{totalGross.toLocaleString("en-IN")}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#991b1b", textTransform: "uppercase" }}>Total Deductions</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#7f1d1d" }}>- ₹{totalDeductions.toLocaleString("en-IN")}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#1e3a8a", textTransform: "uppercase" }}>Estimated Net Take-Home</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#1e40af" }}>₹{totalNet.toLocaleString("en-IN")}</div>
                </div>
              </div>

              {/* 5. Documents Section */}
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
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Offer Letter Link</label>
                  <input
                    type="url"
                    value={editForm.offer_letter_path}
                    onChange={e => setEditForm({ ...editForm, offer_letter_path: e.target.value })}
                    style={inp}
                    placeholder="Paste Drive link"
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>NDA Link</label>
                  <input
                    type="url"
                    value={editForm.nda_path}
                    onChange={e => setEditForm({ ...editForm, nda_path: e.target.value })}
                    style={inp}
                    placeholder="Paste Drive link"
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 2" }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>HR Docs Link</label>
                  <input
                    type="url"
                    value={editForm.hr_docs_path}
                    onChange={e => setEditForm({ ...editForm, hr_docs_path: e.target.value })}
                    style={inp}
                    placeholder="Paste Drive link"
                  />
                </div>

                {/* Global Custom Fields for Documents */}
                {customFieldDefs.filter(f => f.section === "docs").map(fld => (
                  <div key={fld.id} style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 2" }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      {fld.label} Link
                    </label>
                    <input
                      type="url"
                      value={editForm.custom_fields[fld.field_key] || ""}
                      onChange={e => handleGlobalCustomFieldChange(fld.field_key, e.target.value)}
                      style={inp}
                      placeholder="Paste link"
                    />
                  </div>
                ))}
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

      {/* ── Summary Metrics ── */}
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

        {/* Custom Field Settings button for HR Admin / Super Admin */}
        {canEdit && (
          <button
            onClick={() => setCustomSettingsOpen(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "7px 14px", borderRadius: "20px", border: "1px solid #d8b4fe",
              background: "#faf5ff", color: "#7e22ce", fontSize: "0.78rem",
              fontWeight: 700, cursor: "pointer", transition: "all 0.15s", marginLeft: "auto"
            }}
          >
            <SlidersHorizontal size={14} /> Custom Field Settings
          </button>
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
                const isEmp = p.role === "employee";
                const isIntern = p.role === "intern";
                const isAdmin = p.role === "admin";
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
                    <td className="dp-td-dept">
                      {isAdmin
                        ? (p.designation
                            ? (p.designation.startsWith("Admin-") ? p.designation : `Admin-${p.designation}`)
                            : (p.department ? `Admin-${p.department}` : "Admin"))
                        : (p.designation || "—")
                      }
                    </td>
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

                          {/* Active / Deactivate Toggle for Employees, Interns & Admins */}
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