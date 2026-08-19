import React, { useState, useEffect } from "react";
import { Building2, Plus, Pencil, Trash2, Check, X, RefreshCw } from "lucide-react";
import { api } from "../utils/api";

export default function Departments() {
  const [departments, setDepartments]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [msg, setMsg]                   = useState({ type: "", text: "" });
  const [showAdd, setShowAdd]           = useState(false);
  const [newName, setNewName]           = useState("");
  const [newDesc, setNewDesc]           = useState("");
  const [editId, setEditId]             = useState(null);
  const [editName, setEditName]         = useState("");
  const [editDesc, setEditDesc]         = useState("");

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: "", text: "" }), 3500);
  };

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await api.get("/departments");
      setDepartments(res.data);
    } catch (err) {
      flash("error", "Failed to load departments.");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchDepartments(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return flash("error", "Department name is required.");
    setSaving(true);
    try {
      const res = await api.post("/departments", { name: newName.trim(), description: newDesc.trim() });
      setDepartments(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName(""); setNewDesc(""); setShowAdd(false);
      flash("success", `"${res.data.name}" added successfully.`);
    } catch (err) {
      flash("error", err.response?.data?.msg || "Failed to add department.");
    } finally { setSaving(false); }
  };

  const handleEdit = async (id) => {
    if (!editName.trim()) return flash("error", "Department name is required.");
    setSaving(true);
    try {
      const res = await api.put(`/departments/${id}`, { name: editName.trim(), description: editDesc.trim() });
      setDepartments(prev =>
        prev.map(d => d.id === id ? res.data : d).sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditId(null);
      flash("success", `"${res.data.name}" updated.`);
    } catch (err) {
      flash("error", err.response?.data?.msg || "Failed to update department.");
    } finally { setSaving(false); }
  };

  const handleDelete = async (dept) => {
    if (!window.confirm(`Delete "${dept.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/departments/${dept.id}`);
      setDepartments(prev => prev.filter(d => d.id !== dept.id));
      flash("success", `"${dept.name}" deleted.`);
    } catch (err) {
      flash("error", err.response?.data?.msg || "Failed to delete department.");
    }
  };

  const startEdit = (dept) => {
    setEditId(dept.id); setEditName(dept.name); setEditDesc(dept.description || ""); setShowAdd(false);
  };

  const inp = { padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", background: "#fff", width: "100%", boxSizing: "border-box" };

  return (
    <div style={{ padding: "24px", background: "#fff", borderRadius: "12px", minHeight: "400px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: "#eef2ff", padding: 10, borderRadius: 8, color: "#4f46e5" }}><Building2 size={24} /></div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: "#1e293b" }}>Departments</h2>
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
              {departments.length} department{departments.length !== 1 ? "s" : ""} — changes reflect instantly in all dropdowns
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={fetchDepartments} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={() => { setShowAdd(!showAdd); setEditId(null); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#4f46e5", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}>
            <Plus size={14} /> Add Department
          </button>
        </div>
      </div>

      {msg.text && (
        <div style={{ marginBottom: 16, padding: "11px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: msg.type === "success" ? "#dcfce7" : "#fee2e2", color: msg.type === "success" ? "#166534" : "#991b1b", border: `1px solid ${msg.type === "success" ? "#bbf7d0" : "#fecaca"}` }}>
          {msg.text}
        </div>
      )}

      {showAdd && (
        <div style={{ marginBottom: 16, padding: 16, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#4f46e5", marginBottom: 12 }}>New Department</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Name *</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Finance Department" style={inp} onKeyDown={e => e.key === "Enter" && handleAdd()} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Description</label>
              <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional short description" style={inp} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleAdd} disabled={saving} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#4f46e5", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
              <Check size={13} /> {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={() => { setShowAdd(false); setNewName(""); setNewDesc(""); }} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 13, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading departments...</div>
      ) : departments.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", border: "1px dashed #cbd5e1", borderRadius: 12, color: "#64748b" }}>
          No departments yet. Click <strong>Add Department</strong> to create one.
        </div>
      ) : (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr auto", gap: 16, padding: "10px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <span>Name</span><span>Description</span><span>Actions</span>
          </div>
          {departments.map((dept, i) => (
            <div key={dept.id} style={{ borderBottom: i < departments.length - 1 ? "1px solid #f1f5f9" : "none" }}>
              {editId === dept.id ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr auto", gap: 12, padding: "12px 20px", alignItems: "center", background: "#fafafa" }}>
                  <input value={editName} onChange={e => setEditName(e.target.value)} style={{ ...inp, fontSize: 13 }} onKeyDown={e => e.key === "Enter" && handleEdit(dept.id)} />
                  <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description (optional)" style={{ ...inp, fontSize: 13 }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => handleEdit(dept.id)} disabled={saving} style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: "#dcfce7", color: "#166534", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      <Check size={12} /> Save
                    </button>
                    <button onClick={() => setEditId(null)} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 12, cursor: "pointer" }}>
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr auto", gap: 16, padding: "14px 20px", alignItems: "center" }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4f46e5", display: "inline-block", flexShrink: 0 }} />
                    {dept.name}
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>{dept.description || <span style={{ color: "#cbd5e1", fontStyle: "italic" }}>No description</span>}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => startEdit(dept)} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#4f46e5", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                      <Pencil size={11} /> Edit
                    </button>
                    <button onClick={() => handleDelete(dept)} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #fee2e2", background: "#fff5f5", color: "#b91c1c", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
