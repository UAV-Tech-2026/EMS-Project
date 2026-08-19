import React, { useState } from "react";
import { api } from "../utils/api";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, ExternalLink, Download } from "lucide-react";
import * as XLSX from "xlsx";
import "../styles/AttendanceUpload.css";

export default function AttendanceUpload({ readOnly }) {
  const [file,      setFile]      = useState(null);
  const [driveUrl,  setDriveUrl]  = useState("");
  const [uploading, setUploading] = useState(false);
  const [result,    setResult]    = useState(null);
  const [tab,       setTab]       = useState("local");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setResult(null);
  };

  const handleLocalUpload = async () => {
    if (readOnly) return;
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
    if (readOnly) return;
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

  const canUploadLocal = file && !readOnly;
  const canUploadDrive = driveUrl.trim() && !readOnly;

  return (
    <div className="au-root">

      {/* Title */}
      <div className="au-title-block">
        <h3>Upload Attendance</h3>
        <p>Upload an Excel file locally or paste a Google Drive link</p>
      </div>

      {/* Tab switcher */}
      <div className="au-tabs">
        {["local", "drive"].map(t => (
          <button
            key={t}
            className={`au-tab-btn${tab === t ? " active" : ""}`}
            onClick={() => { setTab(t); setResult(null); }}
          >
            {t === "local" ? "📁 Local File" : "☁️ Google Drive"}
          </button>
        ))}
      </div>

      {/* Local File tab */}
      {tab === "local" && (
        <div>
          <label className={`au-dropzone${file ? " has-file" : ""}`}>
            <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
            <FileSpreadsheet size={32} color={file ? "var(--au-green)" : "var(--au-border-drop)"} />
            <span className="au-dropzone-label">
              {file ? file.name : "Click to select .xlsx / .xls file"}
            </span>
            {file && (
              <span className="au-dropzone-size">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            )}
          </label>

          <button
            onClick={handleLocalUpload}
            disabled={uploading || !canUploadLocal}
            className={`au-btn ${canUploadLocal ? "au-btn-green" : "au-btn-disabled"}`}
          >
            <Upload size={15} />
            {uploading ? "Uploading…" : readOnly ? "View Only" : "Upload to Database"}
          </button>
        </div>
      )}

      {/* Google Drive tab */}
      {tab === "drive" && (
        <div>
          <div className="au-drive-info">
            <p>
              1. Open your attendance Excel file in Google Drive<br />
              2. Click <strong>Share → Anyone with the link → Viewer</strong><br />
              3. Copy the link and paste it below
            </p>
            <a href="https://drive.google.com" target="_blank" rel="noreferrer">
              <ExternalLink size={11} /> Open Google Drive
            </a>
          </div>

          <input
            type="text"
            className="au-input"
            placeholder="https://drive.google.com/file/d/..."
            value={driveUrl}
            onChange={e => { setDriveUrl(e.target.value); setResult(null); }}
          />

          <button
            onClick={handleDriveUpload}
            disabled={uploading || !canUploadDrive}
            className={`au-btn ${canUploadDrive ? "au-btn-blue" : "au-btn-disabled"}`}
          >
            <Upload size={15} />
            {uploading ? "Importing…" : readOnly ? "View Only" : "Import from Google Drive"}
          </button>
        </div>
      )}

      {/* Result banner */}
      {result && (
        <div className={`au-result ${result.type}`}>
          {result.type === "success"
            ? <CheckCircle size={16} color="var(--au-green)" />
            : <AlertCircle size={16} color="var(--au-error-border)" />}
          <span>{result.msg}</span>
        </div>
      )}

      {/* Expected format */}
      <div className="au-format">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <p className="au-format-label" style={{ margin: 0 }}>Expected Excel Format</p>
          <button 
            type="button"
            className="au-btn au-btn-blue" 
            style={{ padding: "4px 8px", fontSize: "11px", width: "auto", margin: 0 }}
            onClick={() => {
              const ws = XLSX.utils.aoa_to_sheet([
                ["Employee ID", "Name", "Date", "Status", "Check In", "Check Out"],
                ["UAV-001", "Ravi Kumar", "2025-03-31", "Present", "09:00", "18:00"]
              ]);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Template");
              XLSX.writeFile(wb, "Attendance_Template.xlsx");
            }}
          >
            <Download size={14} /> Download Template
          </button>
        </div>
        <div className="au-format-grid">
          {["Employee ID", "Name", "Date", "Status", "Check In", "Check Out"].map(h => (
            <div key={h} className="au-format-cell header" style={{ padding: "4px 2px" }}>{h}</div>
          ))}
          {["UAV-001", "Ravi Kumar", "2025-03-31", "Present", "09:00", "18:00"].map(v => (
            <div key={v} className="au-format-cell data">{v}</div>
          ))}
        </div>
      </div>

    </div>
  );
}
