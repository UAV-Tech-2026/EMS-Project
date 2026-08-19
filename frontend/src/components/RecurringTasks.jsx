import React, { useState, useEffect, useCallback } from "react";
import { api } from "../utils/api";
import { RotateCcw, Calendar, ChevronDown, Check, X, ShieldCheck, Loader2, AlertCircle, Plus } from "lucide-react";

const STATUS_COLORS = {
  "Pending":     { bg: "#fef9c3", color: "#854d0e" },
  "On Hold":     { bg: "#fee2e2", color: "#b91c1c" },
  "Completed":   { bg: "#dcfce7", color: "#15803d" },
};

const CATEGORY_TAG = {
  "Website Maintenance":   "#0ea5e9",
  "Equipment Maintenance": "#f59e0b",
  "Renewals":              "#a855f7",
};

const todayStr = () => new Date().toISOString().split("T")[0];

// verified is derived from status, matching how completion works everywhere
// else in this app (status = 'Completed' + end_date set).
function isVerified(task) {
  return task.status === "Completed";
}

function statusFor(task) {
  if (isVerified(task)) return "Completed";
  if (task.due_date && task.due_date < todayStr()) return "On Hold"; // overdue, unverified
  return "Pending";
}

function statusLabel(task) {
  if (isVerified(task)) return "Verified & Complete";
  if (task.due_date && task.due_date < todayStr()) return "Overdue — Unverified";
  return "Yet to Complete";
}

function RecurringTaskRow({ task, employees, onReviewerChange, onToggleVerify, saving }) {
  const status = statusFor(task);
  const colors = STATUS_COLORS[status];
  const catColor = CATEGORY_TAG[task.category] || "#64748b";
  const verified = isVerified(task);

  return (
    <div style={styles.row}>
      <div style={styles.dateCol}>
        {task.frequency && (
          <div style={styles.freqBadge}>
            <RotateCcw size={11} />
            {task.frequency}
          </div>
        )}
        <div style={styles.dateText}>
          <Calendar size={13} style={{ opacity: 0.5 }} />
          {task.due_date || "—"}
        </div>
      </div>

      <div style={styles.infoCol}>
        {task.category && (
          <span style={{ ...styles.catTag, background: catColor + "1a", color: catColor }}>
            {task.category}
          </span>
        )}
        <div style={styles.taskTitle}>{task.title}</div>
        {task.link && (
          <a href={task.link} target="_blank" rel="noreferrer" style={styles.linkText}>
            View submitted document ↗
          </a>
        )}
      </div>

      <div style={styles.reviewerCol}>
        <label style={styles.smallLabel}>Reviewer</label>
        <div style={styles.selectWrap}>
          <select
            value={task.reviewer_id || ""}
            disabled={saving}
            onChange={e => onReviewerChange(task.id, parseInt(e.target.value, 10))}
            style={styles.select}
          >
            <option value="" disabled>Select reviewer</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>
                {e.fullname} {e.role === "admin" ? "(Admin)" : ""}
              </option>
            ))}
          </select>
          <ChevronDown size={13} style={styles.selectChevron} />
        </div>
        {task.reviewer_role === "admin" && (
          <div style={styles.adminRight}>
            <ShieldCheck size={11} /> Admin review right
          </div>
        )}
      </div>

      <div style={styles.verifyCol}>
        <label style={styles.smallLabel}>Verified</label>
        <div style={styles.verifyBtns}>
          <button
            disabled={saving}
            onClick={() => onToggleVerify(task.id, true)}
            style={{ ...styles.verifyBtn, ...(verified ? styles.verifyBtnActiveGood : {}) }}
            title="Mark verified — link checked and correct"
          >
            <Check size={14} />
          </button>
          <button
            disabled={saving}
            onClick={() => onToggleVerify(task.id, false)}
            style={{ ...styles.verifyBtn, ...(!verified ? styles.verifyBtnActiveBad : {}) }}
            title="Mark not verified"
          >
            <X size={14} />
          </button>
        </div>
        {verified && task.reviewer_name && (
          <div style={styles.verifiedByText}>by {task.reviewer_name}</div>
        )}
      </div>

      <div style={styles.statusCol}>
        <span style={{ ...styles.statusPill, background: colors.bg, color: colors.color }}>
          {statusLabel(task)}
        </span>
      </div>
    </div>
  );
}

export default function RecurringTasks() {
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingIds, setSavingIds] = useState(new Set());
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ title: "", category: "Website Maintenance", recurring_frequency: "Monthly", due_date: "", reviewer_id: "" });
  const [adding, setAdding] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [tasksRes, employeesRes] = await Promise.all([
        api.get("/tasks/recurring-instances"),
        api.get("/tasks/employees"),
      ]);
      setTasks(tasksRes.data || []);
      setEmployees(employeesRes.data || []);
    } catch (err) {
      console.error("RECURRING TASKS LOAD ERROR:", err);
      setError("Failed to load recurring tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const withSaving = async (taskId, fn) => {
    setSavingIds(prev => new Set(prev).add(taskId));
    try {
      await fn();
    } catch (err) {
      console.error("RECURRING TASK UPDATE ERROR:", err);
      setError("Failed to save change.");
    } finally {
      setSavingIds(prev => { const next = new Set(prev); next.delete(taskId); return next; });
    }
  };

  const handleReviewerChange = (taskId, reviewerId) => {
    withSaving(taskId, async () => {
      await api.patch(`/tasks/${taskId}/reviewer`, { reviewer_id: reviewerId });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, reviewer_id: reviewerId } : t));
    });
  };

  const handleToggleVerify = (taskId, verified) => {
    withSaving(taskId, async () => {
      const res = await api.patch(`/tasks/${taskId}/verify`, { verified });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: res.data.status, end_date: res.data.end_date } : t));
    });
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    setError("");
    try {
      const res = await api.post("/tasks/recurring-manual", addForm);
      setShowAddForm(false);
      setAddForm({ title: "", category: "Website Maintenance", recurring_frequency: "Monthly", due_date: "", reviewer_id: "" });
      loadData(); // reload instances
    } catch (err) {
      console.error("ADD RECURRING ERROR:", err);
      setError("Failed to manually add recurring task.");
    } finally {
      setAdding(false);
    }
  };

  const completedCount = tasks.filter(isVerified).length;

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.h2}>Recurring Tasks</h2>
          
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {!loading && !error && (
            <div style={styles.summaryPill}>
              {completedCount} / {tasks.length} verified this cycle
            </div>
          )}
          <button style={styles.addBtn} onClick={() => setShowAddForm(!showAddForm)}>
            <Plus size={14} /> Manually Add
          </button>
        </div>
      </div>

      {showAddForm && (
        <form onSubmit={handleManualAdd} style={styles.addForm}>
          <input required placeholder="Task Title (e.g. Server Maintenance)" value={addForm.title} onChange={e => setAddForm({...addForm, title: e.target.value})} style={styles.input} />
          
          <select required value={addForm.category} onChange={e => setAddForm({...addForm, category: e.target.value})} style={styles.input}>
            {Object.keys(CATEGORY_TAG).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          
          <select required value={addForm.recurring_frequency} onChange={e => setAddForm({...addForm, recurring_frequency: e.target.value})} style={styles.input}>
            <option value="Monthly">Monthly</option>
            <option value="Quarterly">Quarterly</option>
            <option value="Yearly">Yearly</option>
          </select>

          <input type="date" required value={addForm.due_date} onChange={e => setAddForm({...addForm, due_date: e.target.value})} style={styles.input} min={todayStr()} />

          <select required value={addForm.reviewer_id} onChange={e => setAddForm({...addForm, reviewer_id: e.target.value})} style={styles.input}>
            <option value="" disabled>Select Reviewer *</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.fullname} {e.role === 'admin' ? '(Admin)' : ''}</option>)}
          </select>

          <button type="submit" disabled={adding} style={styles.submitBtn}>
            {adding ? "Adding..." : "Add"}
          </button>
        </form>
      )}

      {error && (
        <div style={styles.errorBanner}>
          <AlertCircle size={14} />
          <span>{error}</span>
          <button onClick={loadData} style={styles.retryBtn}>Retry</button>
        </div>
      )}

      {loading ? (
        <div style={styles.loadingState}>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
          Loading recurring tasks…
        </div>
      ) : (
        <>
          <div style={styles.tableHead}>
            <div style={styles.dateCol}>Due</div>
            <div style={styles.infoCol}>Task</div>
            <div style={styles.reviewerCol}>Reviewer</div>
            <div style={styles.verifyCol}>Verify</div>
            <div style={styles.statusCol}>Status</div>
          </div>

          <div style={styles.list}>
            {tasks.length === 0 && !error && (
              <div style={styles.emptyState}>
                No recurring task instances yet — they'll appear here once the generator runs.
              </div>
            )}
            {tasks.map(task => (
              <RecurringTaskRow
                key={task.id}
                task={task}
                employees={employees}
                saving={savingIds.has(task.id)}
                onReviewerChange={handleReviewerChange}
                onToggleVerify={handleToggleVerify}
              />
            ))}
          </div>
        </>
      )}

    </div>
  );
}

const styles = {
  wrap: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    background: "#f8fafc", padding: "20px", borderRadius: "12px",
    border: "1px solid #e2e8f0", maxWidth: "980px", marginTop: "20px", marginBottom: "20px",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "10px" },
  h2: { margin: 0, fontSize: "18px", fontWeight: 700, color: "#0f172a" },
  subtitle: { margin: "4px 0 0", fontSize: "12.5px", color: "#64748b", maxWidth: "520px", lineHeight: 1.5 },
  addBtn: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "#fff", background: "#4f46e5", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", whiteSpace: "nowrap" },
  addForm: { display: "flex", gap: "10px", flexWrap: "wrap", background: "#fff", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "16px" },
  input: { flex: 1, minWidth: "120px", padding: "6px 10px", fontSize: "12px", borderRadius: "6px", border: "1px solid #cbd5e1" },
  submitBtn: { background: "#10b981", color: "#fff", fontWeight: 600, fontSize: "12px", border: "none", padding: "6px 16px", borderRadius: "6px", cursor: "pointer" },
  summaryPill: { fontSize: "12px", fontWeight: 600, color: "#334155", background: "#fff", border: "1px solid #e2e8f0", padding: "6px 12px", borderRadius: "999px", whiteSpace: "nowrap" },
  errorBanner: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "#b91c1c", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "8px 12px", marginBottom: "12px" },
  retryBtn: { marginLeft: "auto", fontSize: "11.5px", fontWeight: 700, color: "#b91c1c", background: "#fff", border: "1px solid #fca5a5", borderRadius: "6px", padding: "3px 9px", cursor: "pointer" },
  loadingState: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#64748b", padding: "24px 0", justifyContent: "center" },
  emptyState: { fontSize: "12.5px", color: "#94a3b8", textAlign: "center", padding: "20px 0" },
  tableHead: { display: "grid", gridTemplateColumns: "110px 1fr 190px 110px 150px", gap: "10px", padding: "0 14px 8px", fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" },
  list: { display: "flex", flexDirection: "column", gap: "8px" },
  row: { display: "grid", gridTemplateColumns: "110px 1fr 190px 110px 150px", gap: "10px", alignItems: "center", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px 14px" },
  dateCol: { display: "flex", flexDirection: "column", gap: "5px" },
  freqBadge: { display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10.5px", fontWeight: 700, color: "#7c3aed", background: "#f3e8ff", padding: "2px 7px", borderRadius: "999px", width: "fit-content" },
  dateText: { display: "flex", alignItems: "center", gap: "5px", fontSize: "12.5px", color: "#475569", fontWeight: 500 },
  infoCol: { display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 },
  catTag: { fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "5px", width: "fit-content" },
  taskTitle: { fontSize: "13.5px", fontWeight: 600, color: "#1e293b", lineHeight: 1.3 },
  linkText: { fontSize: "11.5px", color: "#2563eb", textDecoration: "none" },
  reviewerCol: { display: "flex", flexDirection: "column", gap: "3px" },
  smallLabel: { fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.03em" },
  selectWrap: { position: "relative" },
  select: { appearance: "none", width: "100%", fontSize: "12.5px", padding: "5px 24px 5px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff", color: "#334155", fontWeight: 500, cursor: "pointer" },
  selectChevron: { position: "absolute", right: "7px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#94a3b8" },
  adminRight: { display: "flex", alignItems: "center", gap: "3px", fontSize: "10px", color: "#15803d", fontWeight: 600 },
  verifyCol: { display: "flex", flexDirection: "column", gap: "4px" },
  verifyBtns: { display: "flex", gap: "5px" },
  verifyBtn: { display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#fff", color: "#94a3b8", cursor: "pointer" },
  verifyBtnActiveGood: { background: "#dcfce7", borderColor: "#86efac", color: "#15803d" },
  verifyBtnActiveBad: { background: "#fee2e2", borderColor: "#fca5a5", color: "#b91c1c" },
  verifiedByText: { fontSize: "10.5px", color: "#94a3b8" },
  statusCol: {},
  statusPill: { display: "inline-block", fontSize: "11.5px", fontWeight: 700, padding: "5px 10px", borderRadius: "999px", whiteSpace: "nowrap" },
  footnote: { marginTop: "16px", fontSize: "11px", color: "#94a3b8", borderTop: "1px dashed #e2e8f0", paddingTop: "10px" },
};
