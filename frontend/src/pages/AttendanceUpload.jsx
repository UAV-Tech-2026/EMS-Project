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

      {/* Expected formats */}
      <div className="au-format">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
          <p className="au-format-label" style={{ margin: 0, fontWeight: "600" }}>Supported Excel Formats</p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button 
              type="button"
              className="au-btn au-btn-blue" 
              style={{ padding: "4px 8px", fontSize: "11px", width: "auto", margin: 0 }}
              onClick={() => {
                const ws = XLSX.utils.aoa_to_sheet([
                  ["Dept. Name", "Default", "", "", "", "", "", "", "", "", "", "", "CompName", "", "", "UAV TECH PVT LTD", "", "", "", "", "", "", "", "", "", "", "Report Month", "", "", "September-2026"],
                  ["Empcode", "0026", "Name", "Sravan", "", "", "", "", "", "", "", "", "Present", "3", "WO", "0", "HL", "0", "LV", "0", "Absent", "27", "Tot. Work+OT", "21:25", "Total OT", "0:00"],
                  ["", "", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31"],
                  ["", "", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu"],
                  ["IN", "", "11:30", "11:02", "--:--", "10:26", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--"],
                  ["OUT", "", "17:45", "18:25", "--:--", "18:13", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--"],
                  ["WORK", "", "06:15", "07:23", "00:00", "07:47", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00"],
                  ["Break", "", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00"],
                  ["OT", "", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00"],
                  ["Status", "", "P", "P", "A", "P", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A"]
                ]);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Biometric Report");
                XLSX.writeFile(wb, "Biometric_Attendance_Template.xlsx");
              }}
            >
              <Download size={14} /> Biometric Template
            </button>
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
                XLSX.writeFile(wb, "Standard_Attendance_Template.xlsx");
              }}
            >
              <Download size={14} /> Standard Template
            </button>
          </div>
        </div>
        <p style={{ fontSize: "12px", color: "var(--au-text-subtle)", margin: "0 0 8px 0" }}>
          ✅ Auto-detects both <strong>Biometric Monthly Export Reports</strong> (Multi-employee Matrix format) and <strong>Standard Tabular Excel</strong>.
        </p>
        <div className="au-format-grid">
          {["Format", "Identified By", "Employee ID / Code", "Dates Handled", "Status Map"].map(h => (
            <div key={h} className="au-format-cell header" style={{ padding: "4px 2px" }}>{h}</div>
          ))}
          {[
            "Biometric Monthly Matrix", "Empcode & Report Month headers", "0026 / UTPLA0026 / Name", "Days 1 to 31 in columns", "P -> Present, A -> Absent, WO -> Off",
            "Standard Tabular", "6-Column headers", "Employee ID column", "Date column (YYYY-MM-DD)", "Present / Absent / Half Day"
          ].map((v, i) => (
            <div key={i} className="au-format-cell data">{v}</div>
          ))}
        </div>
      </div>

    </div>
  );
}
