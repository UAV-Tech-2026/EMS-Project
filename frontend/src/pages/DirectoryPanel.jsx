import React, { useState, useEffect } from "react";
import { api } from "../utils/api";
import { Search, Users, Briefcase, GraduationCap, Camera, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import "../styles/DirectoryPanel.css";

export default function DirectoryPanel() {
  const [people, setPeople]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [filter, setFilter]         = useState("all");
  const [search, setSearch]         = useState("");
  const [uploadingId, setUploadingId] = useState(null);
  const [toast, setToast]           = useState(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isSuper = user.role === "super_admin";

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchDirectory = async () => {
    try {
      setLoading(true);
      const res = await api.get("/attendance/directory");
      setPeople(res.data);
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
      fetchDirectory(); // Refresh to see new initials/photo if we added photo support to table
    } catch (err) {
      showToast("error", "Failed to upload photo");
    } finally {
      setUploadingId(null);
    }
  };

  const empCount  = people.filter(p => p.role === "employee").length;
  const intCount  = people.filter(p => p.role === "intern").length;
  const total     = people.length;

  const filtered = people.filter(p => {
    const matchRole =
      filter === "all" ||
      (filter === "employee" && p.role === "employee") ||
      (filter === "intern"   && p.role === "intern");

    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (p.fullname         || "").toLowerCase().includes(q) ||
      (p.employee_uav_id  || "").toLowerCase().includes(q) ||
      (p.designation       || "").toLowerCase().includes(q);

    return matchRole && matchSearch;
  });

  function initials(name = "") {
    return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  }

  if (loading) return <div className="dp-loading">Loading directory…</div>;
  if (error)   return <div className="dp-error">{error}</div>;

  return (
    <div className="dp-wrap">
      
      {toast && (
        <div style={{
          position: "fixed", top: "20px", right: "20px", zIndex: 1000,
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

      {/* ── Summary cards ── */}
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

        <div className="dp-filters">
          <button
            className={`dp-filter-btn ${filter === "all"      ? "dp-active-all" : ""}`}
            onClick={() => setFilter("all")}
          >
            All <span className="dp-badge">{total}</span>
          </button>
          <button
            className={`dp-filter-btn ${filter === "employee" ? "dp-active-emp" : ""}`}
            onClick={() => setFilter("employee")}
          >
            Employees <span className="dp-badge dp-badge-emp">{empCount}</span>
          </button>
          <button
            className={`dp-filter-btn ${filter === "intern"   ? "dp-active-int" : ""}`}
            onClick={() => setFilter("intern")}
          >
            Interns <span className="dp-badge dp-badge-int">{intCount}</span>
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="dp-table-wrap">
        {filtered.length === 0 ? (
          <div className="dp-empty">No results found for "{search}"</div>
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
                {isSuper && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const isEmp    = p.role === "employee";
                const isActive = (p.status || "").toLowerCase() === "active";
                return (
                  <tr key={p.id}>
                    <td className="dp-td-num">{i + 1}</td>
                    <td>
                      <div className="dp-name-cell">
                        <div className={`dp-avatar ${isEmp ? "dp-av-emp" : "dp-av-int"}`}>
                          {initials(p.fullname)}
                        </div>
                        <span className="dp-name">{p.fullname || "—"}</span>
                      </div>
                    </td>
                    <td className="dp-td-id">{p.employee_uav_id || "—"}</td>
                    <td>
                      <span className={`dp-pill ${isEmp ? "dp-pill-emp" : "dp-pill-int"}`}>
                        {isEmp ? "Employee" : "Intern"}
                      </span>
                    </td>
                    <td className="dp-td-dept">{p.designation || "—"}</td>
                    <td>
                      <span className={`dp-status ${isActive ? "dp-status-active" : "dp-status-inactive"}`}>
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {isSuper && (
                      <td>
                        <label style={{ 
                          display: "inline-flex", alignItems: "center", gap: "5px",
                          padding: "6px 12px", background: "#f1f5f9", borderRadius: "6px",
                          fontSize: "11px", fontWeight: 700, color: "#475569", 
                          cursor: uploadingId === p.id ? "not-allowed" : "pointer",
                          transition: "all 0.2s", border: "1px solid #e2e8f0"
                        }}>
                          {uploadingId === p.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Camera size={12} />
                          )}
                          {uploadingId === p.id ? "Uploading..." : "Set Photo"}
                          <input 
                            type="file" 
                            accept="image/*" 
                            style={{ display: "none" }} 
                            disabled={uploadingId === p.id}
                            onChange={(e) => handleFileChange(e, p.id)} 
                          />
                        </label>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} className="dp-foot">
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
