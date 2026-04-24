import React, { useState, useEffect, useRef } from "react";
import { FileText, Download, Trash2, Upload, File, FilePlus, X, CheckCircle, AlertCircle } from "lucide-react";
import { api } from "../utils/api";
import { useNavigate } from "react-router-dom";

const FILE_ICONS = {
  pdf: { bg: "#fee2e2", color: "#dc2626", label: "PDF" },
  doc: { bg: "#dbeafe", color: "#2563eb", label: "DOC" },
  docx: { bg: "#dbeafe", color: "#2563eb", label: "DOC" },
  xls: { bg: "#dcfce7", color: "#16a34a", label: "XLS" },
  xlsx: { bg: "#dcfce7", color: "#16a34a", label: "XLS" },
  jpg: { bg: "#f3e8ff", color: "#9333ea", label: "IMG" },
  jpeg: { bg: "#f3e8ff", color: "#9333ea", label: "IMG" },
  link: { bg: "#fff7ed", color: "#ea580c", label: "DRIVE" },
};

function getExt(filename) {
  return filename?.split(".").pop()?.toLowerCase() || "";
}

function getFileMeta(filename) {
  const ext = getExt(filename);
  return FILE_ICONS[ext] || { bg: "#f1f5f9", color: "#475569", label: ext.toUpperCase() || "FILE" };
}

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
  });
}

export default function Documents() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null); // { type: "success"|"error", msg }
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [docName, setDocName] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [uploadMode, setUploadMode] = useState("file"); // "file" | "link"
  const fileInputRef = useRef();

  // ── Fetch docs ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await api.get("/documents/my");
      setDocs(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Toast helper ────────────────────────────────────────────────────────────
  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ── File selection ──────────────────────────────────────────────────────────
  const handleFileSelect = (file) => {
    if (!file) return;
    setSelectedFile(file);
    setDocName(file.name.replace(/\.[^.]+$/, "")); // default name = filename without extension
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("document_name", docName || selectedFile.name);

    setUploading(true);
    try {
      await api.post("/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      showToast("success", "Document uploaded successfully!");
      setSelectedFile(null);
      setDocName("");
      fetchDocs(); // refresh list
    } catch (err) {
      console.error("Upload failed:", err);
      showToast("error", err.response?.data?.msg || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveLink = async () => {
    if (!driveLink.trim() || !docName.trim()) return;

    setUploading(true);
    try {
      await api.post("/documents/save-link", {
        document_name: docName,
        drive_link: driveLink
      });
      showToast("success", "Link saved successfully!");
      setDriveLink("");
      setDocName("");
      fetchDocs();
    } catch (err) {
      console.error("Link save failed:", err);
      showToast("error", err.response?.data?.msg || "Failed to save link.");
    } finally {
      setUploading(false);
    }
  };

  // ── Download ────────────────────────────────────────────────────────────────
  const handleDownload = async (doc) => {
    if (doc.file_type === "link") {
      window.open(doc.file_path, "_blank");
      return;
    }
    try {
      const res = await api.get(`/documents/download/${doc.id}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name || doc.document_name || "document";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showToast("error", "Download failed.");
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (docId) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      await api.delete(`/documents/${docId}`);
      showToast("success", "Document deleted.");
      setDocs(prev => prev.filter(d => d.id !== docId));
    } catch (err) {
      showToast("error", "Delete failed.");
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh",
      background: "#f0f4f8",
      padding: "32px 24px",
      fontFamily: "'Segoe UI', sans-serif"
    }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>

        {/* ── Toast ── */}
        {toast && (
          <div style={{
            position: "fixed", top: "20px", right: "20px", zIndex: 9999,
            background: toast.type === "success" ? "#dcfce7" : "#fee2e2",
            color: toast.type === "success" ? "#166534" : "#991b1b",
            border: `1px solid ${toast.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            borderRadius: "10px", padding: "12px 20px",
            display: "flex", alignItems: "center", gap: "10px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: "14px", fontWeight: 500
          }}>
            {toast.type === "success"
              ? <CheckCircle size={18} />
              : <AlertCircle size={18} />}
            {toast.msg}
          </div>
        )}

        {/* ── Header ── */}
        <div style={{ marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#1e293b", marginBottom: "6px" }}>
              📂 My Documents
            </h1>
            <p style={{ color: "#64748b", fontSize: "14px" }}>
              Upload, view, and manage your submitted documents.
            </p>
          </div>
          <button
            onClick={() => {
              const role = JSON.parse(localStorage.getItem("user"))?.role;
              if (role === "super_admin") navigate("/super-admin-dashboard");
              else if (role === "admin_hr") navigate("/admin-dashboard");
              else if (role === "admin") navigate("/admin-dashboard");
              else navigate("/employee-dashboard");
            }}
            style={{
              padding: '8px 16px',
              background: '#3182ce',
              color: '#fff',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px'
            }}
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* ── Mode Toggle ── */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
          <button
            onClick={() => setUploadMode("file")}
            style={{
              padding: "8px 16px", borderRadius: "8px", border: "1px solid #e2e8f0",
              background: uploadMode === "file" ? "#3b82f6" : "#fff",
              color: uploadMode === "file" ? "#fff" : "#475569",
              fontWeight: 600, fontSize: "13px", cursor: "pointer"
            }}
          >
            File Upload
          </button>
          <button
            onClick={() => setUploadMode("link")}
            style={{
              padding: "8px 16px", borderRadius: "8px", border: "1px solid #e2e8f0",
              background: uploadMode === "link" ? "#3b82f6" : "#fff",
              color: uploadMode === "link" ? "#fff" : "#475569",
              fontWeight: 600, fontSize: "13px", cursor: "pointer"
            }}
          >
            Google Drive Link
          </button>
        </div>

        {/* ── Upload Zone ── */}
        <div style={{
          borderRadius: "14px",
          border: uploadMode === "file" && dragOver ? "2px dashed #3b82f6" : "2px dashed #cbd5e1",
          padding: "24px",
          marginBottom: "28px",
          transition: "border-color 0.2s",
          background: (uploadMode === "file" && dragOver) ? "#eff6ff" : "#fff",
        }}
          onDragOver={(e) => { if (uploadMode === "file") { e.preventDefault(); setDragOver(true); } }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {uploadMode === "file" ? (
            <>
              <div style={{ textAlign: "center", marginBottom: selectedFile ? "20px" : "0" }}>
                <div style={{
                  width: "56px", height: "56px", background: "#eff6ff",
                  borderRadius: "12px", display: "flex", alignItems: "center",
                  justifyContent: "center", margin: "0 auto 12px", color: "#3b82f6"
                }}>
                  <FilePlus size={28} />
                </div>
                <p style={{ fontWeight: 600, color: "#1e293b", marginBottom: "6px" }}>
                  Drag & drop a file here, or{" "}
                  <span
                    style={{ color: "#3b82f6", cursor: "pointer", textDecoration: "underline" }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    browse
                  </span>
                </p>
                <p style={{ color: "#94a3b8", fontSize: "13px" }}>
                  Supported: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG (max 10 MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  style={{ display: "none" }}
                  onChange={(e) => handleFileSelect(e.target.files[0])}
                />
              </div>

              {selectedFile && (
                <div style={{
                  background: "#f8fafc", borderRadius: "10px",
                  padding: "16px", border: "1px solid #e2e8f0"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                    <div style={{
                      width: "40px", height: "40px",
                      background: getFileMeta(selectedFile.name).bg,
                      color: getFileMeta(selectedFile.name).color,
                      borderRadius: "8px", display: "flex",
                      alignItems: "center", justifyContent: "center",
                      fontSize: "11px", fontWeight: 700
                    }}>
                      {getFileMeta(selectedFile.name).label}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, color: "#1e293b", fontSize: "14px" }}>{selectedFile.name}</p>
                      <p style={{ color: "#94a3b8", fontSize: "12px" }}>{formatBytes(selectedFile.size)}</p>
                    </div>
                    <button
                      onClick={() => { setSelectedFile(null); setDocName(""); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div style={{ marginBottom: "14px" }}>
                    <label style={{ fontSize: "13px", fontWeight: 600, color: "#475569", display: "block", marginBottom: "6px" }}>
                      Document Name
                    </label>
                    <input
                      type="text"
                      value={docName}
                      onChange={(e) => setDocName(e.target.value)}
                      placeholder="e.g. Offer Letter, ID Proof..."
                      style={{
                        width: "100%", padding: "10px 14px", borderRadius: "8px",
                        border: "1px solid #e2e8f0", fontSize: "14px",
                        outline: "none", boxSizing: "border-box"
                      }}
                    />
                  </div>

                  <button
                    onClick={handleUpload}
                    disabled={uploading || !docName.trim()}
                    style={{
                      padding: "10px 24px", borderRadius: "8px", border: "none",
                      background: uploading || !docName.trim() ? "#93c5fd" : "#3b82f6",
                      color: "#fff", fontWeight: 600, fontSize: "14px",
                      cursor: "pointer", display: "flex", alignItems: "center", gap: "8px"
                    }}
                  >
                    <Upload size={16} />
                    {uploading ? "Uploading..." : "Submit File"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: "8px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                <div style={{
                  width: "48px", height: "48px", background: "#fff7ed",
                  color: "#ea580c", borderRadius: "10px", display: "flex",
                  alignItems: "center", justifyContent: "center"
                }}>
                  <FileText size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#1e293b" }}>Attach Google Drive Link</h3>
                  <p style={{ fontSize: "12px", color: "#64748b" }}>Paste your document sharing link below</p>
                </div>
              </div>

              <div style={{ display: "grid", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "#475569", display: "block", marginBottom: "6px" }}>
                    Document Name
                  </label>
                  <input
                    type="text"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    placeholder="e.g. Experience Certificate, Degree..."
                    style={{
                      width: "100%", padding: "11px 14px", borderRadius: "8px",
                      border: "1px solid #e2e8f0", fontSize: "14px", outline: "none"
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "#475569", display: "block", marginBottom: "6px" }}>
                    Google Drive Link
                  </label>
                  <input
                    type="url"
                    value={driveLink}
                    onChange={(e) => setDriveLink(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    style={{
                      width: "100%", padding: "11px 14px", borderRadius: "8px",
                      border: "1px solid #e2e8f0", fontSize: "14px", outline: "none"
                    }}
                  />
                </div>

                <button
                  onClick={handleSaveLink}
                  disabled={uploading || !docName.trim() || !driveLink.trim()}
                  style={{
                    padding: "12px 24px", borderRadius: "8px", border: "none",
                    background: uploading || !docName.trim() || !driveLink.trim() ? "#93c5fd" : "#3b82f6",
                    color: "#fff", fontWeight: 600, fontSize: "14px",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", width: "fit-content"
                  }}
                >
                  <Upload size={16} />
                  {uploading ? "Saving..." : "Save Link"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Documents List ── */}
        <div style={{
          background: "#fff", borderRadius: "14px",
          border: "1px solid #e2e8f0", overflow: "hidden"
        }}>
          <div style={{
            padding: "18px 24px", borderBottom: "1px solid #f1f5f9",
            display: "flex", alignItems: "center", justifyContent: "space-between"
          }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b" }}>
              Submitted Documents
            </h2>
            <span style={{
              background: "#eff6ff", color: "#3b82f6",
              padding: "4px 12px", borderRadius: "20px",
              fontSize: "12px", fontWeight: 600
            }}>
              {docs.length} file{docs.length !== 1 ? "s" : ""}
            </span>
          </div>

          {loading ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#94a3b8" }}>
              Loading documents...
            </div>
          ) : docs.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center" }}>
              <File size={40} color="#cbd5e1" style={{ margin: "0 auto 12px", display: "block" }} />
              <p style={{ color: "#94a3b8", fontSize: "14px" }}>No documents submitted yet.</p>
              <p style={{ color: "#cbd5e1", fontSize: "13px" }}>Upload your first document above.</p>
            </div>
          ) : (
            <div>
              {docs.map((doc, idx) => {
                const meta = doc.file_type === "link"
                  ? FILE_ICONS.link
                  : getFileMeta(doc.file_name || doc.document_name || "");
                return (
                  <div key={doc.id} style={{
                    padding: "16px 24px",
                    borderBottom: idx < docs.length - 1 ? "1px solid #f1f5f9" : "none",
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between",
                    transition: "background 0.15s"
                  }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <div style={{
                        width: "44px", height: "44px", background: meta.bg,
                        color: meta.color, borderRadius: "10px",
                        display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: "11px", fontWeight: 700
                      }}>
                        {meta.label}
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, color: "#1e293b", fontSize: "14px", marginBottom: "3px" }}>
                          {doc.document_name || doc.file_name}
                        </p>
                        <div style={{ display: "flex", gap: "10px", fontSize: "12px", color: "#94a3b8" }}>
                          {doc.file_type === "link" ? (
                            <span style={{ color: "#ea580c", fontWeight: 500 }}>Google Drive Link</span>
                          ) : (
                            <>
                              {doc.file_name && <span>{doc.file_name}</span>}
                              {doc.file_size && <><span>•</span><span>{formatBytes(doc.file_size)}</span></>}
                            </>
                          )}
                          {doc.uploaded_at && <><span>•</span><span>{formatDate(doc.uploaded_at)}</span></>}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => handleDownload(doc)}
                        title={doc.file_type === "link" ? "View Link" : "Download"}
                        style={{
                          padding: "8px", borderRadius: "8px", border: "none",
                          background: "#f1f5f9", color: "#475569", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center"
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.color = "#3b82f6"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#475569"; }}
                      >
                        {doc.file_type === "link" ? <FileText size={16} /> : <Download size={16} />}
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        title="Delete"
                        style={{
                          padding: "8px", borderRadius: "8px", border: "none",
                          background: "#f1f5f9", color: "#475569", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center"
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.color = "#dc2626"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#475569"; }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
