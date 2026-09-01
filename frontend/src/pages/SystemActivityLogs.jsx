import React, { useState, useEffect } from "react";
import { api } from "../utils/api";
import { Activity, RefreshCw, User, Calendar, Shield } from "lucide-react";

export default function SystemActivityLogs({ limit = 20, isModal = false, onClose }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchLogs = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await api.get("/employees/all-activity-logs");
            setLogs(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Failed to fetch system activity logs:", err);
            setError("Unable to load activity logs.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const content = (
        <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "20px 22px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, borderBottom: "1px solid #f1f5f9", paddingBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "#eef2ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Activity size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>System Audit & Activity Logs</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>Live record of employee enrollments, profile updates & admin actions</div>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                        onClick={fetchLogs}
                        disabled={loading}
                        style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1",
                            background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600,
                            cursor: "pointer"
                        }}
                    >
                        <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
                    </button>
                    {isModal && onClose && (
                        <button
                            onClick={onClose}
                            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer" }}
                        >
                            ✕ Close
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div style={{ padding: "30px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading activity logs...</div>
            ) : error ? (
                <div style={{ padding: "20px", color: "#ef4444", fontSize: 13, textAlign: "center" }}>{error}</div>
            ) : logs.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No activity logs recorded yet.</div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: isModal ? "60vh" : "400px", overflowY: "auto", paddingRight: 4 }}>
                    {logs.slice(0, limit).map((log, index) => (
                        <div
                            key={log.id || index}
                            style={{
                                display: "flex", alignItems: "flex-start", gap: 12,
                                padding: "12px 14px", borderRadius: 8, background: "#f8fafc",
                                border: "1px solid #f1f5f9"
                            }}
                        >
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1", marginTop: 6, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", lineHeight: 1.4 }}>
                                    {log.action}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4, fontSize: 11, color: "#64748b" }}>
                                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                        <User size={12} /> {log.fullname || log.username || "System Admin"} ({log.role || "admin"})
                                    </span>
                                    <span>•</span>
                                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                        <Calendar size={12} /> {new Date(log.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return content;
}
