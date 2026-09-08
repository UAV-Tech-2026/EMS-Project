import { useEffect, useState } from "react";
import { api } from "../utils/api";



const EMS_FEATURES = [
  { name: "attendance",         label: "Attendance",         desc: "View attendance banner and post attendance" },
  { name: "upload_attendance",  label: "Upload Attendance",  desc: "Upload attendance from Excel or Drive" },
  { name: "attendance_records", label: "Attendance Records", desc: "View daily attendance records" },
  { name: "attendance_reports", label: "Attendance Reports", desc: "Export attendance data" },
  { name: "leaves",             label: "Leaves",             desc: "Apply and manage leave requests" },
  { name: "dpr",                label: "DPR",                desc: "Daily progress report tracking" },
  { name: "payslips",           label: "Payslips",           desc: "Generate and download payslips" },
  { name: "tasks",              label: "Tasks",              desc: "Assign and track dev tasks" },
  { name: "directory",          label: "Directory",          desc: "View employee directory" },
  { name: "departments",        label: "Departments",        desc: "Manage company departments" },
  { name: "bulletins",          label: "Bulletins",          desc: "Post and view company bulletins" },
  { name: "enroll",             label: "Enroll Member",      desc: "Onboard new employees, admins or interns" },
  { name: "meetings",           label: "Meetings",           desc: "Schedule and coordinate team syncs" },
  { name: "request_panel",      label: "Request Panel",      desc: "Manage and submit administrative requests" },
];


const SMS_FEATURES = [
  { name: "workstockpro",       label: "SMS Dashboard",      desc: "View the main WorkStock Pro overview dashboard", icon: "📊" },
  { name: "sms_stock_in",       label: "Stock In",           desc: "Add new stock / GRN (Goods Receipt Note) entries", icon: "📥" },
  { name: "sms_withdrawal",     label: "Withdrawal (Stock Out)", desc: "Issue and process stock withdrawal / outward requests", icon: "📤" },
  { name: "sms_master_list",    label: "Master List",        desc: "View and manage the product master list", icon: "📋" },
  { name: "sms_reports",        label: "All Withdrawals",    desc: "Access stock withdrawal records and history", icon: "📈" },
];

const ALL_FEATURES = [...EMS_FEATURES, ...SMS_FEATURES];


const visibilityLabel = (read, write) => {
  if (read && write) return { text: "Read & Write", color: "#10b981", bg: "#ecfdf5" };
  if (read)          return { text: "Read Only",    color: "#3b82f6", bg: "#eff6ff" };
  return               { text: "Hidden",          color: "#94a3b8", bg: "#f8fafc" };
};


function Toggle({ checked, onChange, disabled, label }) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8, cursor: disabled ? "not-allowed" : "pointer" }}
      onClick={() => !disabled && onChange(!checked)}
    >
      <div
        style={{
          width: 40, height: 22, borderRadius: 11,
          background: checked && !disabled ? "#3b82f6" : "#cbd5e1",
          position: "relative", transition: "background 0.2s",
          opacity: disabled ? 0.4 : 1,
          flexShrink: 0,
        }}
      >
        <div style={{
          position: "absolute", top: 3, left: checked ? 21 : 3,
          width: 16, height: 16, borderRadius: "50%", background: "#fff",
          transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </div>
      {label && (
        <span style={{ fontSize: 11, fontWeight: 600, color: disabled ? "#94a3b8" : "#475569", userSelect: "none" }}>
          {label}
        </span>
      )}
    </div>
  );
}

export default function AdminPermissions() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("id"); // "id" | "name"
  
  const [perms, setPerms] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedSmsCard, setExpandedSmsCard] = useState(null);

  const sortAdminsList = (list, criteria = sortBy) => {
    return [...list].sort((a, b) => {
      if (criteria === "name") {
        return (a.fullname || "").localeCompare(b.fullname || "", undefined, { sensitivity: "base" });
      }
      // Natural ID sort (e.g. UTPLA001, UTPLA002, UTPLA010)
      const idA = a.employee_uav_id || "";
      const idB = b.employee_uav_id || "";
      if (idA && idB) {
        return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: "base" });
      }
      if (idA) return -1;
      if (idB) return 1;
      return (a.fullname || "").localeCompare(b.fullname || "", undefined, { sensitivity: "base" });
    });
  };

  useEffect(() => {
    api.get("/permissions/list")
      .then(res => {
        const admins = (res.data || []).filter(u => u.role === "admin");
        const sorted = sortAdminsList(admins, "id");
        setUsers(sorted);
        if (sorted.length > 0 && !selectedUser) {
          selectUser(sorted[0]);
        }
      })
      .catch(err => {
        console.error("Failed to load permissions list:", err);
      });
  }, []);

  const selectUser = (user) => {
    setSelectedUser(user);
    setSaved(false);

    
    const map = {};
    ALL_FEATURES.forEach(f => {
      const existing = user.permissions?.find(p => p.feature_name === f.name);
      map[f.name] = {
        can_read:  existing?.can_read  ?? false,
        can_write: existing?.can_write ?? false,
      };
    });
    setPerms(map);
  };

 
  const setRead = (feature, value) => {
    setPerms(prev => ({
      ...prev,
      [feature]: {
        can_read:  value,
        
        can_write: value ? (prev[feature]?.can_write ?? false) : false,
      },
    }));
  };

  const setWrite = (feature, value) => {
    setPerms(prev => ({
      ...prev,
      [feature]: {
       
        can_read:  value ? true : (prev[feature]?.can_read ?? false),
        can_write: value,
      },
    }));
  };

  const savePermissions = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const payload = ALL_FEATURES.map(f => ({
        feature_name: f.name,
        can_read:  perms[f.name]?.can_read  ?? false,
        can_write: perms[f.name]?.can_write ?? false,
      }));
      await api.post("/permissions/update", {
        user_id: selectedUser.id,
        permissions: payload,
      });
      setSaved(true);
     
      const res = await api.get("/permissions/list");
      const updated = res.data.find(u => u.id === selectedUser.id);
      if (updated) {
        setUsers(prev => prev.map(u => u.id === selectedUser.id ? updated : u));
       
        const map = {};
        ALL_FEATURES.forEach(f => {
          const existing = updated.permissions?.find(p => p.feature_name === f.name);
          map[f.name] = {
            can_read:  existing?.can_read  ?? false,
            can_write: existing?.can_write ?? false,
          };
        });
        setPerms(map);
        setSelectedUser(updated);
      }
    } catch (err) {
      alert(err.response?.data?.msg || "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = (role) => {
    const map = { admin: "Admin" };
    return map[role] || role;
  };


  const renderFeatureGroup = (features, groupLabel, groupColor = "#4f46e5", groupBg = "#eef2ff") => (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 10, padding: "6px 12px",
        background: groupBg, borderRadius: 8,
        borderLeft: `3px solid ${groupColor}`,
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: groupColor, textTransform: "uppercase", letterSpacing: 1 }}>
          {groupLabel}
        </span>
      </div>
      
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 90px 90px 130px",
        padding: "8px 16px", borderRadius: 8,
        background: "#f1f5f9", marginBottom: 4,
        fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8
      }}>
        <span>Feature</span>
        <span style={{ textAlign: "center" }}>Read</span>
        <span style={{ textAlign: "center" }}>Write</span>
        <span style={{ textAlign: "center" }}>Visibility</span>
      </div>
      {features.map(f => {
        const p = perms[f.name] || { can_read: false, can_write: false };
        const vis = visibilityLabel(p.can_read, p.can_write);
        return (
          <div
            key={f.name}
            style={{
              display: "grid", gridTemplateColumns: "1fr 90px 90px 130px",
              padding: "12px 16px", borderRadius: 8,
              background: "#fff", border: "1px solid #f1f5f9",
              marginBottom: 4, alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{f.label}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{f.desc}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Toggle checked={p.can_read} onChange={(v) => setRead(f.name, v)} />
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Toggle
                checked={p.can_write}
                disabled={!p.can_read}
                onChange={(v) => setWrite(f.name, v)}
              />
            </div>
            <div style={{ textAlign: "center" }}>
              <span style={{
                fontSize: 12, fontWeight: 700, color: vis.color,
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: vis.color, display: "inline-block" }} />
                {vis.text}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );


  const renderSmsCards = () => (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 14, padding: "8px 14px",
        background: "linear-gradient(135deg, #ecfeff 0%, #e0f2fe 100%)", borderRadius: 10,
        borderLeft: "4px solid #0891b2",
      }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#0891b2", textTransform: "uppercase", letterSpacing: 1 }}>
          SMS — Stock Management System (WorkStock Pro)
        </span>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 14,
      }}>
        {SMS_FEATURES.map(f => {
          const p = perms[f.name] || { can_read: false, can_write: false };
          const vis = visibilityLabel(p.can_read, p.can_write);
          const isActive = p.can_read;
          const isExpanded = expandedSmsCard === f.name;
          return (
            <div
              key={f.name}
              onClick={() => setExpandedSmsCard(isExpanded ? null : f.name)}
              style={{
                background: isExpanded
                  ? "linear-gradient(145deg, #ffffff 0%, #f0fdfa 100%)"
                  : isActive ? "#f0fdfa" : "#fafbfc",
                border: `1.5px solid ${isExpanded ? "#0891b2" : isActive ? "#99f6e4" : "#e8ecf0"}`,
                borderRadius: 14,
                padding: isExpanded ? "18px 18px 16px" : "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: isExpanded ? 14 : 0,
                transition: "all 0.25s ease",
                boxShadow: isExpanded
                  ? "0 6px 24px rgba(8, 145, 178, 0.12)"
                  : isActive ? "0 2px 8px rgba(8, 145, 178, 0.06)" : "0 1px 4px rgba(0,0,0,0.03)",
                position: "relative",
                overflow: "hidden",
                cursor: "pointer",
              }}
            >
              
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 3,
                background: isExpanded
                  ? "linear-gradient(90deg, #0891b2, #06b6d4, #22d3ee)"
                  : isActive ? "#06b6d4" : "#e2e8f0",
                transition: "background 0.3s",
              }} />

            
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: isExpanded ? 44 : 38, height: isExpanded ? 44 : 38, borderRadius: isExpanded ? 11 : 9,
                  background: isActive ? "#ecfeff" : "#f1f5f9",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: isExpanded ? 22 : 18, flexShrink: 0,
                  border: `1px solid ${isActive ? "#cffafe" : "#e2e8f0"}`,
                  transition: "all 0.25s",
                }}>
                  {f.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: isExpanded ? 14 : 13, fontWeight: 700, color: "#0f172a",
                    lineHeight: 1.2,
                  }}>
                    {f.label}
                  </div>
                  {!isExpanded && (
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                      Click to configure
                    </div>
                  )}
                </div>
               
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "2px 8px", borderRadius: 20,
                    background: vis.bg, border: `1px solid ${vis.color}22`,
                    fontSize: 10, fontWeight: 700, color: vis.color,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: vis.color, display: "inline-block" }} />
                    {vis.text}
                  </span>
                  <span style={{
                    fontSize: 12, color: "#94a3b8",
                    transition: "transform 0.2s",
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                  }}>
                    ▼
                  </span>
                </div>
              </div>

              
              {isExpanded && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 2 }}>
                  <div style={{
                    fontSize: 11, color: "#64748b", lineHeight: 1.4,
                    padding: "0 4px",
                  }}>
                    {f.desc}
                  </div>

                
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: "flex", gap: 20, alignItems: "center",
                      padding: "10px 12px",
                      background: "#f8fafc",
                      borderRadius: 10,
                      border: "1px solid #f1f5f9",
                    }}
                  >
                    <Toggle
                      checked={p.can_read}
                      onChange={(v) => setRead(f.name, v)}
                      label="Read"
                    />
                    <div style={{ width: 1, height: 20, background: "#e2e8f0" }} />
                    <Toggle
                      checked={p.can_write}
                      disabled={!p.can_read}
                      onChange={(v) => setWrite(f.name, v)}
                      label="Write"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const getAdminLabel = (user) => {
    if (!user) return "";
    const rawDept = user.designation || user.department || "Admin";
    if (rawDept.startsWith("Admin-") || rawDept.startsWith("ADMIN-")) return rawDept;
    return `Admin-${rawDept}`;
  };

  const displayedUsers = sortAdminsList(
    users.filter(u => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const adminLbl = getAdminLabel(u).toLowerCase();
      return (
        adminLbl.includes(q) ||
        (u.fullname || "").toLowerCase().includes(q) ||
        (u.employee_uav_id || "").toLowerCase().includes(q) ||
        (u.department || "").toLowerCase().includes(q)
      );
    }),
    sortBy
  );

  return (
    <div style={{ display: "flex", gap: 20, minHeight: 450 }}>
      
      {/* ── Admin Selector Sidebar ── */}
      <div style={{ width: 250, flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>
            Admins ({displayedUsers.length})
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              fontSize: 10, fontWeight: 700, padding: "2px 6px",
              borderRadius: 6, border: "1px solid #cbd5e1",
              background: "#fff", color: "#475569", cursor: "pointer"
            }}
            title="Sort order"
          >
            <option value="id">Sort by ID</option>
            <option value="name">Sort A-Z</option>
          </select>
        </div>

        {/* Search filter */}
        <div style={{ marginBottom: 10 }}>
          <input
            type="text"
            placeholder="Search admin, ID, dept..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%", padding: "6px 10px", borderRadius: 8,
              border: "1px solid #e2e8f0", fontSize: 12, outline: "none",
              background: "#f8fafc", boxSizing: "border-box"
            }}
          />
        </div>

        <div style={{ maxHeight: "72vh", overflowY: "auto", paddingRight: 4, display: "flex", flexDirection: "column", gap: 6 }}>
          {displayedUsers.length === 0 ? (
            <div style={{ padding: "20px 10px", textAlign: "center", color: "#94a3b8", fontSize: 12, background: "#f8fafc", borderRadius: 8 }}>
              No admins match "{searchQuery}"
            </div>
          ) : (
            displayedUsers.map(u => {
              const isSelected = selectedUser?.id === u.id;
              const displayLabel = getAdminLabel(u);
              return (
                <div
                  key={u.id}
                  onClick={() => selectUser(u)}
                  style={{
                    padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                    background: isSelected ? "#eff6ff" : "#fff",
                    border: `1.5px solid ${isSelected ? "#3b82f6" : "#e2e8f0"}`,
                    boxShadow: isSelected ? "0 2px 8px rgba(59,130,246,0.12)" : "0 1px 2px rgba(0,0,0,0.02)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: isSelected ? 700 : 600, color: isSelected ? "#1d4ed8" : "#1e293b", lineHeight: 1.3 }}>
                      {displayLabel}
                    </span>
                    {u.employee_uav_id && (
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        background: isSelected ? "#dbeafe" : "#f1f5f9",
                        color: isSelected ? "#1d4ed8" : "#475569",
                        padding: "1px 5px", borderRadius: 4, fontFamily: "monospace", flexShrink: 0, marginLeft: 6
                      }}>
                        {u.employee_uav_id}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      
      <div style={{ flex: 1 }}>
        {!selectedUser ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            Select an admin to manage their permissions
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{getAdminLabel(selectedUser)}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {selectedUser.department ? `${selectedUser.department} · ` : ""}{selectedUser.employee_uav_id || roleLabel(selectedUser.role)}
                </div>
              </div>
              <button
                onClick={savePermissions}
                disabled={saving}
                style={{
                  padding: "8px 20px", borderRadius: 8, border: "none",
                  background: saved ? "#10b981" : "#3b82f6",
                  color: "#fff", fontWeight: 700, fontSize: 13,
                  cursor: saving ? "not-allowed" : "pointer",
                  transition: "background 0.2s",
                }}


                
              >
                {saving ? "Saving…" : saved ? "✓ Saved" : "Save Permissions"}
              </button>
            </div>

          
            {renderFeatureGroup(EMS_FEATURES, "EMS — Employee Management Features", "#6366f1", "#eef2ff")}

           
            {renderSmsCards()}
          </>
        )}
      </div>
    </div>
  );
}

