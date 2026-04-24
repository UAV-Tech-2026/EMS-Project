import { useState, useEffect } from "react";
import { api } from "../utils/api";
import { 
  Shield, Save, 
  Search, AlertCircle, CheckCircle2,
  Lock
} from "lucide-react";

const FEATURES = [
  { id: "attendance", label: "Attendance (Banner)", desc: "View attendance banner and post attendance" },
  { id: "upload_attendance", label: "Upload Attendance", desc: "Upload attendance from Excel or Drive" },
  { id: "attendance_records", label: "Attendance Records", desc: "View daily attendance records" },
  { id: "attendance_reports", label: "Attendance Reports", desc: "Export attendance data" },
  { id: "leaves", label: "Leaves", desc: "Apply and manage leave requests" },
  { id: "dpr", label: "DPR", desc: "Daily progress report tracking" },
  { id: "payslips", label: "Payslips", desc: "Generate and download payslips" },
  { id: "tasks", label: "Tasks", desc: "Assign and track dev tasks" },
  { id: "directory", label: "Directory", desc: "View employee directory" },
  { id: "departments", label: "Departments", desc: "Manage company departments" },
  { id: "bulletins", label: "Bulletins", desc: "Post and view company bulletins" },
];

export default function ControlPanel() {
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  const [admins, setAdmins] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await api.get("/permissions/list");
      setAdmins(res.data);
    } catch (err) {
      setMsg({ type: "error", text: "Failed to load administrator list." });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (userId) => {
    if (!userId) {
      setSelectedUser(null);
      setPermissions({});
      return;
    }

    const user = admins.find(u => String(u.id) === String(userId));
    if (!user) return;

    setSelectedUser(user);
    const permMap = {};
    FEATURES.forEach(f => {
      const existing = user.permissions?.find(p => p.feature_name === f.id);
      permMap[f.id] = existing
        ? { can_read: existing.can_read, can_write: existing.can_write }
        : { can_read: false, can_write: false };
    });
    setPermissions(permMap);
  };

  const handleToggle = (featureId, type) => {
    setPermissions(prev => {
      const current = prev[featureId] || { can_read: false, can_write: false };
      const newValue = !current[type];
      const updated = { ...current, [type]: newValue };

      if (type === "can_write" && newValue) updated.can_read = true;
      if (type === "can_read" && !newValue) updated.can_write = false;

      return { ...prev, [featureId]: updated };
    });
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        user_id: selectedUser.id,
        permissions: Object.entries(permissions).map(([id, val]) => ({
          feature_name: id,
          ...val
        }))
      };
      await api.post("/permissions/update", payload);
      setMsg({ type: "success", text: "Permissions saved successfully!" });
      fetchAdmins();
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setMsg({ type: "error", text: "Failed to update permissions." });
    } finally {
      setSaving(false);
    }
  };

  const standardAdmins = admins.filter(a => a.role === "admin");
  const hrAdmins = admins.filter(a => a.role === "admin_hr");

  return (
    <div className="sad-cp-container">
      <div className="sad-cp-header">
        <div className="sad-cp-title-row">
          <Shield className="sad-cp-icon" />
          <div>
            <h2>Control Panel</h2>
            <p>Manage feature permissions for each administrator.</p>
          </div>
        </div>

        <div className="sad-cp-search-row">
          <div className="sad-cp-select-wrap">
            <Search size={16} className="select-icon" />
            <select
              value={selectedUser?.id || ""}
              onChange={(e) => handleSelectUser(e.target.value)}
              className="sad-cp-select"
            >
              <option value="">Select an administrator...</option>
              {standardAdmins.length > 0 && (
                <optgroup label="Standard Admins">
                  {standardAdmins.map(u => (
                    u.id !== currentUser.id && (
                      <option key={u.id} value={u.id}>
                        {u.fullname || u.username} ({u.username})
                      </option>
                    )
                  ))}
                </optgroup>
              )}
              {hrAdmins.length > 0 && (
                <optgroup label="HR Admins">
                  {hrAdmins.map(u => (
                    u.id !== currentUser.id && (
                      <option key={u.id} value={u.id}>
                        {u.fullname || u.username} ({u.username})
                      </option>
                    )
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>
      </div>

      {msg && (
        <div className={`sad-cp-toast ${msg.type}`}>
          {msg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{msg.text}</span>
        </div>
      )}

      {!selectedUser ? (
        <div className="sad-cp-no-selection">
          <Lock size={40} strokeWidth={1.5} />
          <p>Please select an administrator to manage their permissions</p>
        </div>
      ) : (
        <div className="sad-cp-content">
          <div className="sad-cp-role-card">
            <div className="sad-cp-role-left">
              <div className="sad-cp-avatar">
                {(selectedUser.fullname || selectedUser.username).charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="sad-cp-role-name">{selectedUser.fullname || selectedUser.username}</div>
                <div className="sad-cp-role-desc">
                  {selectedUser.username} • {
                    selectedUser.role === 'admin_hr' ? 'HR Admin' :
                    selectedUser.role === 'admin' ? 'Standard Admin' :
                    selectedUser.role === 'intern' ? 'Intern' : 'Employee'
                  }
                </div>
              </div>
            </div>
            <div className="sad-cp-summary-line">
              {Object.values(permissions).filter(p => p.can_read).length} features enabled
            </div>
          </div>

          <div className="sad-cp-table-wrap">
            <table className="sad-cp-perm-table">
              <thead>
                <tr>
                  <th>FEATURE</th>
                  <th>READ</th>
                  <th>WRITE</th>
                  <th>VISIBILITY</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map(f => {
                  const p = permissions[f.id] || { can_read: false, can_write: false };
                  return (
                    <tr key={f.id}>
                      <td className="sad-cp-feat-cell">
                        <span className="sad-cp-feat-label">{f.label}</span>
                        <span className="sad-cp-feat-desc">{f.desc}</span>
                      </td>
                      <td className="sad-cp-toggle-cell">
                        <label className="sad-cp-toggle">
                          <input
                            type="checkbox"
                            checked={p.can_read}
                            onChange={() => handleToggle(f.id, "can_read")}
                          />
                          <div className="sad-cp-toggle-track">
                            <div className="sad-cp-toggle-thumb"></div>
                          </div>
                        </label>
                      </td>
                      <td className="sad-cp-toggle-cell">
                        <label className="sad-cp-toggle">
                          <input
                            type="checkbox"
                            checked={p.can_write}
                            onChange={() => handleToggle(f.id, "can_write")}
                          />
                          <div className="sad-cp-toggle-track">
                            <div className="sad-cp-toggle-thumb"></div>
                          </div>
                        </label>
                      </td>
                      <td>
                        {p.can_write ? (
                          <span className="sad-cp-vis-badge sad-cp-vis-rw">
                            <span className="sad-cp-vis-dot"></span> Read & Write
                          </span>
                        ) : p.can_read ? (
                          <span className="sad-cp-vis-badge sad-cp-vis-ro">
                            <span className="sad-cp-vis-dot"></span> Read Only
                          </span>
                        ) : (
                          <span className="sad-cp-vis-badge sad-cp-vis-hd">
                            <span className="sad-cp-vis-dot"></span> Hidden
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="sad-cp-footer">
            <button
              className="sad-cp-save-btn"
              onClick={handleSave}
              disabled={saving}
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save Permissions"}
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .sad-cp-container { animation: fadeIn 0.4s ease-out; }
        .sad-cp-header { margin-bottom: 24px; }
        .sad-cp-title-row { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 24px; }
        .sad-cp-icon { width: 32px; height: 32px; color: #6366f1; background: #eef2ff; padding: 6px; border-radius: 10px; }
        .sad-cp-title-row h2 { margin: 0; font-size: 20px; font-weight: 800; color: #1e293b; }
        .sad-cp-title-row p { margin: 4px 0 0; font-size: 14px; color: #64748b; }

        .sad-cp-search-row { display: flex; gap: 16px; align-items: center; }
        .sad-cp-select-wrap { position: relative; flex: 1; max-width: 400px; }
        .select-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }
        .sad-cp-select { width: 100%; padding: 10px 12px 10px 38px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; background: #fff; color: #1e293b; outline: none; transition: all 0.2s; }
        .sad-cp-select:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1); }

        .sad-cp-toast { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 10px; margin-bottom: 20px; font-size: 14px; font-weight: 600; }
        .sad-cp-toast.success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
        .sad-cp-toast.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

        .sad-cp-no-selection { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: #94a3b8; gap: 12px; }
        .sad-cp-no-selection p { font-size: 14px; margin: 0; }

        .sad-cp-role-card { display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; }
        .sad-cp-role-left { display: flex; align-items: center; gap: 14px; }
        .sad-cp-avatar { width: 40px; height: 40px; border-radius: 50%; background: #eef2ff; color: #6366f1; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; }
        .sad-cp-role-name { font-size: 15px; font-weight: 700; color: #1e293b; }
        .sad-cp-role-desc { font-size: 12px; color: #64748b; margin-top: 2px; }
        .sad-cp-summary-line { font-size: 13px; color: #6366f1; font-weight: 600; }

        .sad-cp-table-wrap { overflow-x: auto; }
        .sad-cp-perm-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .sad-cp-perm-table th { text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; border-bottom: 1px solid #f1f5f9; }
        .sad-cp-perm-table td { padding: 14px 16px; border-bottom: 1px solid #f8fafc; vertical-align: middle; }
        .sad-cp-perm-table tr:last-child td { border-bottom: none; }
        .sad-cp-perm-table tr:hover td { background: #fafafa; }

        .sad-cp-feat-cell { display: flex; flex-direction: column; gap: 2px; }
        .sad-cp-feat-label { font-weight: 600; color: #1e293b; }
        .sad-cp-feat-desc { font-size: 12px; color: #94a3b8; }

        .sad-cp-toggle-cell { text-align: center; }
        .sad-cp-toggle { position: relative; display: inline-block; cursor: pointer; }
        .sad-cp-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
        .sad-cp-toggle-track { width: 36px; height: 20px; background: #e2e8f0; border-radius: 10px; transition: background 0.2s; position: relative; }
        .sad-cp-toggle input:checked + .sad-cp-toggle-track { background: #6366f1; }
        .sad-cp-toggle-thumb { position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; background: white; border-radius: 50%; transition: transform 0.2s; }
        .sad-cp-toggle input:checked + .sad-cp-toggle-track .sad-cp-toggle-thumb { transform: translateX(16px); }

        .sad-cp-vis-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .sad-cp-vis-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
        .sad-cp-vis-rw { background: #f0fdf4; color: #166534; }
        .sad-cp-vis-rw .sad-cp-vis-dot { background: #22c55e; }
        .sad-cp-vis-ro { background: #eff6ff; color: #1d4ed8; }
        .sad-cp-vis-ro .sad-cp-vis-dot { background: #3b82f6; }
        .sad-cp-vis-hd { background: #f8fafc; color: #94a3b8; }
        .sad-cp-vis-hd .sad-cp-vis-dot { background: #cbd5e1; }

        .sad-cp-footer { display: flex; justify-content: flex-end; margin-top: 24px; }
        .sad-cp-save-btn { display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity 0.2s; }
        .sad-cp-save-btn:hover:not(:disabled) { opacity: 0.9; }
        .sad-cp-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}


