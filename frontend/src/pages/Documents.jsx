import React from "react";
import { FileText, Download, Clock, CheckCircle } from "lucide-react";

export default function Documents() {
  const docs = [
    { id: 1, name: "Employee Handbook.pdf", type: "PDF", size: "2.4 MB", date: "2024-01-15" },
    { id: 2, name: "Policy_Manual_v2.docx", type: "Word", size: "1.1 MB", date: "2024-02-10" },
    { id: 3, name: "Tax_Declaration_Form.pdf", type: "PDF", size: "850 KB", date: "2024-03-01" },
  ];

  return (
    <div style={{ padding: "40px", maxWidth: "1000px", margin: "0 auto", fontFamily: "'Inter', sans-serif" }}>
      <header style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", color: "#1e293b", fontWeight: "700", marginBottom: "8px" }}>Documents</h1>
        <p style={{ color: "#64748b", fontSize: "16px" }}>View and download your official documents and company policies.</p>
      </header>

      <div style={{ display: "grid", gap: "20px" }}>
        {docs.map(doc => (
          <div key={doc.id} style={{ 
            background: "#fff", 
            padding: "20px", 
            borderRadius: "12px", 
            border: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            transition: "all 0.2s",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = "#3b82f6"}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = "#e2e8f0"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ 
                width: "48px", 
                height: "48px", 
                background: "#eff6ff", 
                borderRadius: "10px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                color: "#3b82f6"
              }}>
                <FileText size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: "16px", color: "#1e293b", fontWeight: "600", marginBottom: "4px" }}>{doc.name}</h3>
                <div style={{ display: "flex", gap: "12px", fontSize: "13px", color: "#64748b" }}>
                  <span>{doc.type}</span>
                  <span>•</span>
                  <span>{doc.size}</span>
                  <span>•</span>
                  <span>{doc.date}</span>
                </div>
              </div>
            </div>
            
            <button style={{ 
              padding: "10px", 
              borderRadius: "8px", 
              border: "none", 
              background: "#f8fafc", 
              color: "#64748b",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.color = "#3b82f6"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.color = "#64748b"; }}
            >
              <Download size={20} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "40px", padding: "24px", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
        <h4 style={{ fontSize: "14px", color: "#475569", fontWeight: "600", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Clock size={16} /> Upload New Document
        </h4>
        <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px" }}>Need to submit a document? Upload it here for HR review.</p>
        <button style={{ 
          padding: "10px 20px", 
          borderRadius: "8px", 
          border: "none", 
          background: "#3b82f6", 
          color: "#fff", 
          fontWeight: "600", 
          fontSize: "14px", 
          cursor: "pointer" 
        }}>
          Upload File
        </button>
      </div>
    </div>
  );
}
