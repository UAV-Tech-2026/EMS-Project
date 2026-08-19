import { useEffect, useState } from "react";
import { api } from "../utils/api";
import { Send, Megaphone, User, Clock } from "lucide-react";

export default function Bulletins({ readOnly }) {
  const [bulletins, setBulletins] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchBulletins();
  }, []);

  const fetchBulletins = async () => {
    try {
      const res = await api.get("/bulletins");
      setBulletins(res.data);
    } catch (err) {
      console.error("Error fetching bulletins", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/bulletins", { title, content });
      setTitle("");
      setContent("");
      fetchBulletins();
    } catch (err) {
      setError("Failed to post bulletin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
        <div style={{ background: "#f5f3ff", padding: "10px", borderRadius: "10px", color: "#8b5cf6" }}>
          <Megaphone size={24} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", color: "#1e293b" }}>Company Bulletins</h2>
          <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>Important updates and announcements</p>
        </div>
      </div>

      {!readOnly && (
        <form onSubmit={handleSubmit} style={{ background: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "30px", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", color: "#334155" }}>Post New Bulletin</h3>
          <input
            type="text"
            placeholder="Bulletin Title (Optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "8px", marginBottom: "12px", fontSize: "14px", boxSizing: "border-box" }}
          />
          <textarea
            placeholder="Write your announcement here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={4}
            style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "8px", marginBottom: "12px", fontSize: "14px", resize: "vertical", boxSizing: "border-box" }}
          />
          {error && <div style={{ color: "#ef4444", fontSize: "13px", marginBottom: "12px" }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" disabled={loading} style={{ background: "#6366f1", color: "#fff", border: "none", padding: "8px 20px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
              {loading ? "Posting..." : <><Send size={16} /> Post Bulletin</>}
            </button>
          </div>
        </form>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {bulletins.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
            No bulletins found.
          </div>
        ) : (
          bulletins.map((b) => (
            <div key={b.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.03)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: "4px", height: "100%", background: "#6366f1" }}></div>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "18px", color: "#0f172a" }}>{b.title || "Announcement"}</h4>
              <p style={{ margin: "0 0 16px 0", fontSize: "15px", color: "#475569", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{b.content}</p>
              
              <div style={{ display: "flex", alignItems: "center", gap: "16px", paddingTop: "14px", borderTop: "1px solid #f1f5f9", fontSize: "13px", color: "#64748b" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <User size={14} /> <span style={{ fontWeight: 600 }}>By {b.author_name || "Admin"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Clock size={14} /> <span>{new Date(b.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}