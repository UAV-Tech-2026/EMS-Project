import React, { useState, useEffect } from "react";
import { api } from "../utils/api";
import { Search, Users, Briefcase, GraduationCap } from "lucide-react";
import "../styles/DirectoryPanel.css";

export default function DirectoryPanel() {
  const [people, setPeople]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [filter, setFilter]         = useState("all");
  const [search, setSearch]         = useState("");

  useEffect(() => {
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
    fetchDirectory();
  }, []);

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
