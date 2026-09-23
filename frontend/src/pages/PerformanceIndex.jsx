import React, { useState, useEffect, useMemo } from "react";
import { api } from "../utils/api";
import {
  TrendingUp,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Filter,
  RefreshCw,
  PieChart as PieIcon,
  Award
} from "lucide-react";

export default function PerformanceIndex() {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    completed: 0,
    incompleted: 0,
    available: 0,
    completion_rate: 0,
    avg_days_taken: "0"
  });

  // Filter States
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [selectedAssignedBy, setSelectedAssignedBy] = useState("all");
  const [selectedReviewedBy, setSelectedReviewedBy] = useState("all");

  const todayStr = new Date().toISOString().split("T")[0];
  const firstDayOfMonth = todayStr.slice(0, 7) + "-01";

  const [fromDate, setFromDate] = useState(firstDayOfMonth);
  const [toDate, setToDate] = useState(todayStr);

  const fetchPerformanceData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedEmployee !== "all") params.employee_id = selectedEmployee;
      if (selectedAssignedBy !== "all") params.assigned_by = selectedAssignedBy;
      if (selectedReviewedBy !== "all") params.reviewed_by = selectedReviewedBy;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const res = await api.get("/tasks/performance-index", { params });
      
      setEmployees(res.data.employees || []);
      setAdmins(res.data.admins || []);
      setTasks(res.data.tasks || []);
      setMetrics(res.data.metrics || {
        total: 0,
        completed: 0,
        incompleted: 0,
        available: 0,
        completion_rate: 0,
        avg_days_taken: "0"
      });
    } catch (err) {
      console.error("Failed to load performance index data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
  }, [selectedEmployee, selectedAssignedBy, selectedReviewedBy, fromDate, toDate]);

  const handlePresetDate = (type) => {
    const today = new Date();
    if (type === "month") {
      setFromDate(todayStr.slice(0, 7) + "-01");
      setToDate(todayStr);
    } else if (type === "30days") {
      const past = new Date(today);
      past.setDate(past.getDate() - 30);
      setFromDate(past.toISOString().split("T")[0]);
      setToDate(todayStr);
    } else if (type === "reset") {
      setFromDate("");
      setToDate("");
      setSelectedEmployee("all");
      setSelectedAssignedBy("all");
      setSelectedReviewedBy("all");
    }
  };

  // SVG Pie Chart calculation
  const pieChartData = useMemo(() => {
    const total = metrics.total || 0;
    if (total === 0) return [];
    
    const slices = [
      { label: "Completed", value: metrics.completed, color: "#10b981" },
      { label: "Incompleted / In Progress", value: metrics.incompleted, color: "#f59e0b" },
      { label: "Available / Pending", value: metrics.available, color: "#0284c7" }
    ].filter(s => s.value > 0);

    let cumulativeAngle = 0;
    return slices.map(slice => {
      const percentage = ((slice.value / total) * 100).toFixed(1);
      const angle = (slice.value / total) * 360;
      const startAngle = cumulativeAngle;
      cumulativeAngle += angle;

      return {
        ...slice,
        percentage,
        startAngle,
        endAngle: cumulativeAngle
      };
    });
  }, [metrics]);

  const renderPieSvg = () => {
    if (metrics.total === 0) {
      return (
        <div style={{ textAlign: "center", padding: "30px 10px", color: "#94a3b8", fontSize: "13px" }}>
          No task data available for selected criteria
        </div>
      );
    }

    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", flexWrap: "wrap", gap: "20px" }}>
        <div style={{ position: "relative", width: "160px", height: "160px" }}>
          <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)", borderRadius: "50%" }}>
            {pieChartData.map((slice, idx) => {
              const startRad = (slice.startAngle * Math.PI) / 180;
              const endRad = (slice.endAngle * Math.PI) / 180;
              const x1 = 50 + 40 * Math.cos(startRad);
              const y1 = 50 + 40 * Math.sin(startRad);
              const x2 = 50 + 40 * Math.cos(endRad);
              const y2 = 50 + 40 * Math.sin(endRad);
              const largeArcFlag = slice.endAngle - slice.startAngle > 180 ? 1 : 0;

              if (slice.endAngle - slice.startAngle >= 359.9) {
                return (
                  <circle
                    key={idx}
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={slice.color}
                    strokeWidth="20"
                  />
                );
              }

              const pathData = [
                `M 50 50`,
                `L ${x1} ${y1}`,
                `A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                `Z`
              ].join(" ");

              return <path key={idx} d={pathData} fill={slice.color} stroke="#ffffff" strokeWidth="1.5" />;
            })}
          </svg>
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "70px",
            height: "70px",
            background: "#ffffff",
            borderRadius: "50%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
          }}>
            <span style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>{metrics.completion_rate}%</span>
            <span style={{ fontSize: "9px", color: "#64748b", fontWeight: "700", textTransform: "uppercase" }}>Done</span>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, minWidth: "180px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 12px", background: "#f8fafc", borderRadius: "8px" }}>
            <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "#10b981" }}></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "#1e293b" }}>Completed</div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>{metrics.completed} tasks ({metrics.total > 0 ? ((metrics.completed / metrics.total) * 100).toFixed(1) : 0}%)</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 12px", background: "#f8fafc", borderRadius: "8px" }}>
            <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "#f59e0b" }}></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "#1e293b" }}>Incompleted / In Progress</div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>{metrics.incompleted} tasks ({metrics.total > 0 ? ((metrics.incompleted / metrics.total) * 100).toFixed(1) : 0}%)</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 12px", background: "#f8fafc", borderRadius: "8px" }}>
            <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "#0284c7" }}></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "#1e293b" }}>Available / Pending</div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>{metrics.available} tasks ({metrics.total > 0 ? ((metrics.available / metrics.total) * 100).toFixed(1) : 0}%)</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getStatusBadge = (status) => {
    const st = (status || "Pending").toLowerCase();
    if (st === "completed") {
      return <span style={{ padding: "3px 10px", borderRadius: "12px", background: "#d1fae5", color: "#065f46", fontSize: "11px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px" }}><CheckCircle2 size={12} /> Completed</span>;
    }
    if (st === "in progress" || st === "review") {
      return <span style={{ padding: "3px 10px", borderRadius: "12px", background: "#fef3c7", color: "#92400e", fontSize: "11px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px" }}><Clock size={12} /> In Progress</span>;
    }
    return <span style={{ padding: "3px 10px", borderRadius: "12px", background: "#e0f2fe", color: "#075985", fontSize: "11px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px" }}><AlertCircle size={12} /> Pending</span>;
  };

  return (
    <div style={{ padding: "24px", background: "#f8fafc", minHeight: "100vh", animation: "piFadeIn 0.3s ease-out" }}>
      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "38px", height: "38px", background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", boxShadow: "0 4px 12px rgba(99, 102, 241, 0.25)" }}>
              <TrendingUp size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: "22px", fontWeight: "800", margin: 0, color: "#0f172a", letterSpacing: "-0.02em" }}>Performance Index</h1>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "2px 0 0" }}>Employee performance analytics, duration, time taken & metrics overview</p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchPerformanceData}
          disabled={loading}
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1",
            background: "#ffffff", color: "#334155", fontWeight: "600", fontSize: "13px",
            cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
          }}
        >
          <RefreshCw size={15} className={loading ? "spin-icon" : ""} />
          Refresh Data
        </button>
      </div>

      {/* ── CONTROL PANEL & FILTERS CARD ── */}
      <div style={{ background: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "20px", marginBottom: "24px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", color: "#475569", fontSize: "13px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          <Filter size={16} color="#6366f1" /> Filter Performance Data
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          {/* Employee Dropdown */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
              Employee Name
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: "8px",
                border: "1px solid #cbd5e1", background: "#fff", fontSize: "13px",
                color: "#0f172a", outline: "none", fontWeight: "500"
              }}
            >
              <option value="all">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullname} {emp.employee_uav_id ? `(${emp.employee_uav_id})` : ""} {emp.department ? `· ${emp.department}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: "8px",
                border: "1px solid #cbd5e1", background: "#fff", fontSize: "13px",
                color: "#0f172a", outline: "none", boxSizing: "border-box"
              }}
            />
          </div>

          {/* To Date */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: "8px",
                border: "1px solid #cbd5e1", background: "#fff", fontSize: "13px",
                color: "#0f172a", outline: "none", boxSizing: "border-box"
              }}
            />
          </div>

          {/* Assigned By Admin Dropdown */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
              Assigned By (Admin)
            </label>
            <select
              value={selectedAssignedBy}
              onChange={(e) => setSelectedAssignedBy(e.target.value)}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: "8px",
                border: "1px solid #cbd5e1", background: "#fff", fontSize: "13px",
                color: "#0f172a", outline: "none", fontWeight: "500"
              }}
            >
              <option value="all">All Assigning Admins</option>
              {admins.map(adm => (
                <option key={adm.id} value={adm.id}>
                  {adm.fullname} {adm.employee_uav_id ? `(${adm.employee_uav_id})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Reviewed By Admin Dropdown */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
              Reviewed By (Admin)
            </label>
            <select
              value={selectedReviewedBy}
              onChange={(e) => setSelectedReviewedBy(e.target.value)}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: "8px",
                border: "1px solid #cbd5e1", background: "#fff", fontSize: "13px",
                color: "#0f172a", outline: "none", fontWeight: "500"
              }}
            >
              <option value="all">All Reviewing Admins</option>
              {admins.map(adm => (
                <option key={adm.id} value={adm.id}>
                  {adm.fullname} {adm.employee_uav_id ? `(${adm.employee_uav_id})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Quick Presets */}
        <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>Presets:</span>
          <button
            onClick={() => handlePresetDate("month")}
            style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#f1f5f9", fontSize: "11px", fontWeight: "600", color: "#475569", cursor: "pointer" }}
          >
            This Month
          </button>
          <button
            onClick={() => handlePresetDate("30days")}
            style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#f1f5f9", fontSize: "11px", fontWeight: "600", color: "#475569", cursor: "pointer" }}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => handlePresetDate("reset")}
            style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid #fed7aa", background: "#fff7ed", fontSize: "11px", fontWeight: "700", color: "#c2410c", cursor: "pointer" }}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* ── METRICS & PIE CHART GRID ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", marginBottom: "24px" }}>
        {/* Pie Chart Card */}
        <div style={{ background: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "20px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ fontSize: "15px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
              <PieIcon size={18} color="#6366f1" /> Task Metrics Breakdown
            </div>
            <span style={{ fontSize: "11px", fontWeight: "700", background: "#eef2ff", color: "#4f46e5", padding: "2px 8px", borderRadius: "12px" }}>
              {metrics.total} Total Tasks
            </span>
          </div>
          {renderPieSvg()}
        </div>

        {/* Metric Overview Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
          <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>Total Tasks</span>
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#eef2ff", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileText size={16} />
              </div>
            </div>
            <div style={{ marginTop: "12px" }}>
              <div style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a" }}>{metrics.total}</div>
              <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>Assigned tasks count</div>
            </div>
          </div>

          <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>Completion Rate</span>
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#ecfdf5", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Award size={16} />
              </div>
            </div>
            <div style={{ marginTop: "12px" }}>
              <div style={{ fontSize: "24px", fontWeight: "800", color: "#10b981" }}>{metrics.completion_rate}%</div>
              <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>Tasks finished successfully</div>
            </div>
          </div>

          <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>Avg Time Taken</span>
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Clock size={16} />
              </div>
            </div>
            <div style={{ marginTop: "12px" }}>
              <div style={{ fontSize: "24px", fontWeight: "800", color: "#ea580c" }}>{metrics.avg_days_taken} <span style={{ fontSize: "14px", fontWeight: "600" }}>days</span></div>
              <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>Average completion duration</div>
            </div>
          </div>

          <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>Available / Pending</span>
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0f9ff", color: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Clock size={16} />
              </div>
            </div>
            <div style={{ marginTop: "12px" }}>
              <div style={{ fontSize: "24px", fontWeight: "800", color: "#0284c7" }}>{metrics.available}</div>
              <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>Tasks pending assignment/start</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TASK DETAILS TABLE ── */}
      <div style={{ background: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: "800", margin: 0, color: "#0f172a" }}>Task Details</h2>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0" }}>Detailed log of assigned tasks, completion dates, duration and reviewing admins</p>
          </div>
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#475569", background: "#f1f5f9", padding: "4px 12px", borderRadius: "20px" }}>
            {tasks.length} Records
          </span>
        </div>

        {loading ? (
          <div style={{ padding: "50px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
            Loading performance tasks...
          </div>
        ) : tasks.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#94a3b8" }}>
            <FileText size={36} style={{ marginBottom: "10px", opacity: 0.5 }} />
            <div style={{ fontSize: "14px", fontWeight: "600", color: "#475569" }}>No tasks found</div>
            <div style={{ fontSize: "12px", marginTop: "4px" }}>Try adjusting your filters or date range above.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.5px" }}>
                  <th style={{ padding: "12px 16px", width: "60px", textAlign: "center" }}>S.No</th>
                  <th style={{ padding: "12px 16px" }}>Task Title & Employee</th>
                  <th style={{ padding: "12px 16px" }}>Date Assigned</th>
                  <th style={{ padding: "12px 16px" }}>Completed Date</th>
                  <th style={{ padding: "12px 16px" }}>Duration</th>
                  <th style={{ padding: "12px 16px" }}>Time Taken</th>
                  <th style={{ padding: "12px 16px" }}>Assigned By</th>
                  <th style={{ padding: "12px 16px" }}>Reviewed By</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s" }} className="pi-table-row">
                    <td style={{ padding: "14px 16px", textAlign: "center", fontWeight: "700", color: "#64748b" }}>{t.s_no}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontWeight: "700", color: "#0f172a", marginBottom: "2px" }}>{t.title}</div>
                      <div style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>👤 {t.assigned_to_name || "Unassigned"}</span>
                        {t.assigned_to_uav_id && <span style={{ background: "#e2e8f0", color: "#334155", padding: "1px 5px", borderRadius: "4px", fontFamily: "monospace", fontSize: "10px" }}>{t.assigned_to_uav_id}</span>}
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", color: "#334155", whiteSpace: "nowrap" }}>
                      {t.assignment_date ? new Date(t.assignment_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : (t.start_date || "—")}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#334155", whiteSpace: "nowrap" }}>
                      {t.end_date ? new Date(t.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#475569", fontWeight: "600" }}>
                      {t.duration_display}
                    </td>
                    <td style={{ padding: "14px 16px", fontWeight: "700", color: t.time_taken_display !== "—" ? "#0284c7" : "#94a3b8" }}>
                      {t.time_taken_display}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#334155" }}>
                      {t.assigned_by_name ? (
                        <span style={{ background: "#f1f5f9", padding: "3px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: "600" }}>
                          {t.assigned_by_name}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#334155" }}>
                      {t.reviewed_by_name ? (
                        <span style={{ background: "#f1f5f9", padding: "3px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: "600" }}>
                          {t.reviewed_by_name}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                      {getStatusBadge(t.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .spin-icon { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes piFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .pi-table-row:hover { background: #f8fafc; }
      `}</style>
    </div>
  );
}
