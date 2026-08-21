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
  
  const [perms, setPerms] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedSmsCard, setExpandedSmsCard] = useState(null);

  useEffect(() => {
    api.get("/permissions/list").then(res => {
      
      const admins = res.data.filter(u => u.role === "admin");
      setUsers(admins);
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

  return (
    <div style={{ display: "flex", gap: 20, minHeight: 400 }}>
      
      <div style={{ width: 220, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
          Select Admin
        </div>
        {users.map(u => (
          <div
            key={u.id}
            onClick={() => selectUser(u)}
            style={{
              padding: "10px 14px", borderRadius: 10, cursor: "pointer", marginBottom: 6,
              background: selectedUser?.id === u.id ? "#eff6ff" : "#f8fafc",
              border: `1px solid ${selectedUser?.id === u.id ? "#bfdbfe" : "#e2e8f0"}`,
              transition: "all 0.15s",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{u.fullname}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              {u.department ? `${u.department}` : roleLabel(u.role)}
              {u.employee_uav_id ? ` (${u.employee_uav_id})` : ""}
            </div>
          </div>
        ))}
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
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{selectedUser.fullname}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {selectedUser.email} · {selectedUser.department ? `${selectedUser.department} · ` : ""}{selectedUser.employee_uav_id || roleLabel(selectedUser.role)}
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

