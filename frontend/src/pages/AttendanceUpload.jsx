import React, { useState } from "react";
import { api } from "../utils/api";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";

export default function AttendanceUpload() {
  const [file,       setFile]       = useState(null);
  const [driveUrl,   setDriveUrl]   = useState("");
  const [uploading,  setUploading]  = useState(false);
  const [result,     setResult]     = useState(null); // { type: "success"|"error", msg }
  const [tab,        setTab]        = useState("local"); // "local" | "drive"

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setResult(null);
  };

  const handleLocalUpload = async () => {
    if (!file) { setResult({ type: "error", msg: "Please select an Excel file first." }); return; }
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls"].includes(ext)) {
      setResult({ type: "error", msg: "Only .xlsx or .xls files are accepted." });
      return;
    }

    try {
      setUploading(true);
      setResult(null);
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/attendance/upload-excel", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult({ type: "success", msg: res.data.msg || "Attendance uploaded successfully!" });
      setFile(null);
    } catch (err) {
      setResult({ type: "error", msg: err.response?.data?.msg || "Upload failed. Please try again." });
    } finally {
      setUploading(false);
    }
  };

  const handleDriveUpload = async () => {
    if (!driveUrl.trim()) { setResult({ type: "error", msg: "Please enter a Google Drive link." }); return; }
    if (!driveUrl.includes("drive.google.com")) {
      setResult({ type: "error", msg: "Please enter a valid Google Drive URL." });
      return;
    }

    try {
      setUploading(true);
      setResult(null);
      const res = await api.post("/attendance/upload-from-drive", { url: driveUrl });
      setResult({ type: "success", msg: res.data.msg || "Attendance imported from Google Drive!" });
      setDriveUrl("");
    } catch (err) {
      setResult({ type: "error", msg: err.response?.data?.msg || "Import failed. Make sure the file is publicly shared." });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: "#f8fafc" }}>

      {/* Title */}
      <div style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>
          Upload Attendance
        </h3>
        <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
          Upload an Excel file locally or paste a Google Drive link
        </p>
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", background: "#0f172a", border: "1px solid #334155",
        borderRadius: "8px", overflow: "hidden", marginBottom: "1.25rem", width: "fit-content" }}>
        {["local", "drive"].map(t => (
          <button key={t} onClick={() => { setTab(t); setResult(null); }}
            style={{
              padding: "8px 20px", fontSize: "12px", fontWeight: 600,
              background: tab === t ? "#1e293b" : "transparent",
              color: tab === t ? "#10b981" : "#64748b",
              border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.15s",
            }}>
            {t === "local" ? "📁 Local File" : "☁️ Google Drive"}
          </button>
        ))}
      </div>

      {/* Local upload */}
      {tab === "local" && (
        <div>
          <label style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", border: "2px dashed #334155",
            borderRadius: "10px", padding: "2rem", cursor: "pointer",
            background: file ? "#0c1e14" : "#0f172a",
            borderColor: file ? "#10b981" : "#334155",
            transition: "all 0.2s", marginBottom: "1rem",
          }}>
            <input type="file" accept=".xlsx,.xls" style={{ display: "none" }}
              onChange={handleFileChange} />
            <FileSpreadsheet size={32} color={file ? "#10b981" : "#334155"} />
            <span style={{ marginTop: "10px", fontSize: "13px",
              color: file ? "#10b981" : "#475569", fontWeight: 500 }}>
              {file ? file.name : "Click to select .xlsx / .xls file"}
            </span>
            {file && (
              <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                {(file.size / 1024).toFixed(1)} KB
              </span>
            )}
          </label>

          <button onClick={handleLocalUpload} disabled={uploading || !file}
            style={{
              width: "100%", padding: "11px", background: file ? "#10b981" : "#1e293b",
              color: file ? "#0f172a" : "#475569", border: "none", borderRadius: "8px",
              fontSize: "13px", fontWeight: 700, cursor: file ? "pointer" : "not-allowed",
              fontFamily: "'DM Sans', sans-serif", display: "flex",
              alignItems: "center", justifyContent: "center", gap: "8px",
              transition: "all 0.15s",
            }}>
            <Upload size={15} />
            {uploading ? "Uploading…" : "Upload to Database"}
          </button>
        </div>
      )}

      {/* Google Drive */}
      {tab === "drive" && (
        <div>
          <div style={{ background: "#1e293b", border: "1px solid #334155",
            borderRadius: "10px", padding: "14px", marginBottom: "1rem" }}>
            <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#94a3b8", lineHeight: 1.6 }}>
              1. Open your attendance Excel file in Google Drive<br />
              2. Click <strong style={{ color: "#f8fafc" }}>Share → Anyone with the link → Viewer</strong><br />
              3. Copy the link and paste it below
            </p>
            <a href="https://drive.google.com" target="_blank" rel="noreferrer"
              style={{ fontSize: "11px", color: "#3b82f6", display: "flex",
                alignItems: "center", gap: "4px", textDecoration: "none" }}>
              <ExternalLink size={11} /> Open Google Drive
            </a>
          </div>

          <input
            type="text"
            placeholder="https://drive.google.com/file/d/..."
            value={driveUrl}
            onChange={e => { setDriveUrl(e.target.value); setResult(null); }}
            style={{
              width: "100%", padding: "10px 14px", background: "#0f172a",
              border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc",
              fontSize: "13px", fontFamily: "'DM Sans', sans-serif",
              outline: "none", marginBottom: "1rem", boxSizing: "border-box",
            }}
          />

          <button onClick={handleDriveUpload} disabled={uploading || !driveUrl.trim()}
            style={{
              width: "100%", padding: "11px",
              background: driveUrl.trim() ? "#3b82f6" : "#1e293b",
              color: driveUrl.trim() ? "#fff" : "#475569",
              border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700,
              cursor: driveUrl.trim() ? "pointer" : "not-allowed",
              fontFamily: "'DM Sans', sans-serif", display: "flex",
              alignItems: "center", justifyContent: "center", gap: "8px",
              transition: "all 0.15s",
            }}>
            <Upload size={15} />
            {uploading ? "Importing…" : "Import from Google Drive"}
          </button>
        </div>
      )}

      {/* Result message */}
      {result && (
        <div style={{
          marginTop: "1rem", padding: "12px 14px", borderRadius: "8px",
          background: result.type === "success" ? "#0c1e14" : "#1a0a0a",
          border: `1px solid ${result.type === "success" ? "#10b981" : "#ef4444"}`,
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          {result.type === "success"
            ? <CheckCircle size={16} color="#10b981" />
            : <AlertCircle size={16} color="#ef4444" />}
          <span style={{
            fontSize: "13px", fontWeight: 500,
            color: result.type === "success" ? "#10b981" : "#ef4444",
          }}>
            {result.msg}
          </span>
        </div>
      )}

      {/* Expected format */}
      <div style={{ marginTop: "1.25rem", background: "#0f172a",
        border: "1px solid #1e293b", borderRadius: "8px", padding: "12px 14px" }}>
        <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 600,
          color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Expected Excel Format
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
          gap: "4px", fontSize: "11px" }}>
          {["Employee ID", "Name", "Date", "Status", "Check In / Out"].map(h => (
            <div key={h} style={{ background: "#1a3a6b", color: "#93c5fd",
              padding: "4px 6px", borderRadius: "4px", fontWeight: 600,
              textAlign: "center" }}>{h}</div>
          ))}
          {["UAV-001", "Ravi Kumar", "2025-03-31", "Present", "09:00 / 18:00"].map(v => (
            <div key={v} style={{ background: "#1e293b", color: "#94a3b8",
              padding: "4px 6px", borderRadius: "4px", textAlign: "center" }}>{v}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
