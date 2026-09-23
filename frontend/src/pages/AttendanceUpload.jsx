import React, { useState, useEffect } from "react";
import { api } from "../utils/api";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, ExternalLink, Download } from "lucide-react";
import * as XLSX from "xlsx";
import "../styles/AttendanceUpload.css";

export default function AttendanceUpload({ readOnly }) {
  const [file, setFile] = useState(null);
  const [driveUrl, setDriveUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState("local");
  const [previewData, setPreviewData] = useState(null); // { type: "pdf" | "excel" | "html", title, url, html }
  const [registeredUsers, setRegisteredUsers] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get("/attendance/employees-list");
        setRegisteredUsers(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to load employees list for templates:", err);
      }
    };
    fetchUsers();
  }, []);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    setFile(selected);
    setResult(null);
  };

  const handleLivePreview = async () => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "pdf") {
      const url = URL.createObjectURL(file);
      setPreviewData({ type: "pdf", title: file.name, url });
    } else if (["xlsx", "xls"].includes(ext)) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: "array" });
        let fullHtml = "";
        wb.SheetNames.forEach((name) => {
          const sheetHtml = XLSX.utils.sheet_to_html(wb.Sheets[name]);
          fullHtml += `<div style="margin-bottom: 24px;"><h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 14px; font-weight: 700; border-bottom: 2px solid #3b82f6; padding-bottom: 4px;">📊 Sheet: ${name}</h4>${sheetHtml}</div>`;
        });
        setPreviewData({
          type: "excel",
          title: `${file.name} (${wb.SheetNames.length} Sheet${wb.SheetNames.length > 1 ? "s" : ""})`,
          html: fullHtml
        });
      } catch (err) {
        alert("Could not render Excel preview: " + err.message);
      }
    }
  };

  const handleLocalUpload = async () => {
    if (readOnly) return;
    if (!file) { setResult({ type: "error", msg: "Please select an Excel or PDF file first." }); return; }
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls", "pdf"].includes(ext)) {
      setResult({ type: "error", msg: "Only .xlsx, .xls, or .pdf files are accepted." });
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
      setResult({ type: "success", msg: res.data.msg || "Attendance file uploaded successfully!" });
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
        <h3>Upload Attendance & Leave Reports</h3>
        <p>Upload an Excel (.xlsx / .xls) or PDF (.pdf) report locally or paste a Google Drive link to sync attendance and update employee dashboards (CL, ML, LOP)</p>
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
            <input type="file" accept=".xlsx,.xls,.pdf" onChange={handleFileChange} />
            <FileSpreadsheet size={32} color={file ? "var(--au-green)" : "var(--au-border-drop)"} />
            <span className="au-dropzone-label">
              {file ? file.name : "Click to select .xlsx / .xls / .pdf file"}
            </span>
            {file && (
              <span className="au-dropzone-size">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            )}
          </label>

          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button
              onClick={handleLocalUpload}
              disabled={uploading || !canUploadLocal}
              className={`au-btn ${canUploadLocal ? "au-btn-green" : "au-btn-disabled"}`}
              style={{ flex: 1 }}
            >
              <Upload size={15} />
              {uploading ? "Uploading…" : readOnly ? "View Only" : "Upload to Database"}
            </button>

            {file && (
              <button
                type="button"
                onClick={handleLivePreview}
                className="au-btn au-btn-blue"
                style={{ width: "auto", padding: "0 14px", fontSize: "13px" }}
              >
                👁️ Live Preview
              </button>
            )}
          </div>
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
          <p className="au-format-label" style={{ margin: 0, fontWeight: "600" }}>Supported File Formats (.xlsx, .xls, .pdf)</p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="au-btn au-btn-blue"
              style={{ padding: "4px 8px", fontSize: "11px", width: "auto", margin: 0 }}
              onClick={() => {
                const sampleUser = registeredUsers[0] || { employee_uav_id: "UTPLS001", fullname: "Employee 1" };
                const ws = XLSX.utils.aoa_to_sheet([
                  ["Dept. Name", "Default", "", "", "", "", "", "", "", "", "", "", "CompName", "", "", "COMPANY NAME", "", "", "", "", "", "", "", "", "", "", "Report Month", "", "", "September-2026"],
                  ["Empcode", sampleUser.employee_uav_id || "UTPLS001", "Name", sampleUser.fullname || "Employee 1", "", "", "", "", "", "", "", "", "Present", "3", "WO", "0", "HL", "0", "LV", "0", "Absent", "27", "Tot. Work+OT", "21:25", "Total OT", "0:00"],
                  ["", "", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31"],
                  ["", "", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu"],
                  ["IN", "", "11:30", "11:02", "--:--", "10:26", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--"],
                  ["OUT", "", "17:45", "18:25", "--:--", "18:13", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--", "--:--"],
                  ["WORK", "", "06:15", "07:23", "00:00", "07:47", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00"],
                  ["Break", "", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00"],
                  ["OT", "", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00"],
                  ["Status", "", "P", "P", "A", "CL", "ML", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A"]
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
                const u1 = registeredUsers[0] || { employee_uav_id: "UTPLS001", fullname: "Employee 1" };
                const u2 = registeredUsers[1] || registeredUsers[0] || { employee_uav_id: "UTPLA001", fullname: "Employee 2" };
                const todayStr = new Date().toISOString().split("T")[0];
                const ws = XLSX.utils.aoa_to_sheet([
                  ["Employee ID", "Name", "Date", "Status", "Check In", "Check Out"],
                  [u1.employee_uav_id || "UTPLS001", u1.fullname || "Employee 1", todayStr, "CL", "09:00", "18:00"],
                  [u2.employee_uav_id || "UTPLA001", u2.fullname || "Employee 2", todayStr, "ML", "09:30", "18:30"]
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
        <p style={{ fontSize: "12px", color: "var(--au-text-subtle)", margin: "0 0 10px 0" }}>
          ✅ Auto-detects <strong>Biometric Monthly Reports</strong>, <strong>Standard Excel Tables</strong>, and <strong>PDF Attendance/Leave Files</strong>.
        </p>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: "11px", borderCollapse: "separate", borderSpacing: "4px" }}>
            <thead>
              <tr>
                <th style={{ background: "var(--au-bg-header-cell)", color: "var(--au-text-header-cell)", padding: "6px 8px", borderRadius: "4px", textAlign: "left" }}>Format</th>
                <th style={{ background: "var(--au-bg-header-cell)", color: "var(--au-text-header-cell)", padding: "6px 8px", borderRadius: "4px", textAlign: "left" }}>Identified By</th>
                <th style={{ background: "var(--au-bg-header-cell)", color: "var(--au-text-header-cell)", padding: "6px 8px", borderRadius: "4px", textAlign: "left" }}>Employee ID / Code</th>
                <th style={{ background: "var(--au-bg-header-cell)", color: "var(--au-text-header-cell)", padding: "6px 8px", borderRadius: "4px", textAlign: "left" }}>Dates</th>
                <th style={{ background: "var(--au-bg-header-cell)", color: "var(--au-text-header-cell)", padding: "6px 8px", borderRadius: "4px", textAlign: "left" }}>Status Mapping</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ background: "var(--au-bg-data-cell)", padding: "6px 8px", borderRadius: "4px" }}>Biometric Matrix</td>
                <td style={{ background: "var(--au-bg-data-cell)", padding: "6px 8px", borderRadius: "4px" }}>Empcode &amp; Month headers</td>
                <td style={{ background: "var(--au-bg-data-cell)", padding: "6px 8px", borderRadius: "4px" }}>Numeric Code / Employee ID / Name</td>
                <td style={{ background: "var(--au-bg-data-cell)", padding: "6px 8px", borderRadius: "4px" }}>Days 1 to 31 in columns</td>
                <td style={{ background: "var(--au-bg-data-cell)", padding: "6px 8px", borderRadius: "4px" }}>P -&gt; Present, A -&gt; Absent, CL -&gt; Casual Leave, ML -&gt; Medical Leave</td>
              </tr>
              <tr>
                <td style={{ background: "var(--au-bg-data-cell)", padding: "6px 8px", borderRadius: "4px" }}>Standard Excel / PDF</td>
                <td style={{ background: "var(--au-bg-data-cell)", padding: "6px 8px", borderRadius: "4px" }}>Standard Columns / PDF Text</td>
                <td style={{ background: "var(--au-bg-data-cell)", padding: "6px 8px", borderRadius: "4px" }}>Employee ID column</td>
                <td style={{ background: "var(--au-bg-data-cell)", padding: "6px 8px", borderRadius: "4px" }}>Date column (YYYY-MM-DD)</td>
                <td style={{ background: "var(--au-bg-data-cell)", padding: "6px 8px", borderRadius: "4px" }}>Present / Absent / CL / ML / LOP / Half Day</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Preview Modal Overlay */}
      {previewData && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(15, 23, 42, 0.75)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px"
        }}>
          <div style={{
            background: "#ffffff", borderRadius: "16px",
            width: "100%", maxWidth: "900px", maxHeight: "88vh",
            display: "flex", flexDirection: "column", overflow: "hidden",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)"
          }}>
            <div style={{
              padding: "16px 20px", background: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
              display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                📄 Live On-Screen Preview: {previewData.title}
              </h4>
              <button
                type="button"
                onClick={() => setPreviewData(null)}
                style={{
                  background: "#fee2e2", color: "#991b1b", border: "none",
                  padding: "6px 12px", borderRadius: "8px", fontWeight: 700,
                  cursor: "pointer", fontSize: "13px"
                }}
              >
                ✕ Close Preview
              </button>
            </div>

            <div style={{ flex: 1, padding: "16px", overflow: "auto" }}>
              {previewData.type === "pdf" && (
                <iframe
                  src={previewData.url}
                  title="PDF Live Preview"
                  style={{ width: "100%", height: "550px", border: "none", borderRadius: "8px" }}
                />
              )}
              {previewData.type === "excel" && (
                <div
                  className="excel-preview-container"
                  dangerouslySetInnerHTML={{ __html: previewData.html }}
                />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}