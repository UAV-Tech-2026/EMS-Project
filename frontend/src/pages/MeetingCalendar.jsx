import React, { useState, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid/index.js";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import "../styles/MeetingCalendar.css";

const PUBLIC_HOLIDAYS = [
  { title: "New Year's Day", date: "2026-01-01" },
  { title: "Republic Day", date: "2026-01-26" },
  { title: "Holi", date: "2026-03-03" },
  { title: "Ramzan Id (Eid-ul-Fitar)", date: "2026-03-20" },
  { title: "Good Friday", date: "2026-04-03" },
  { title: "Independence Day", date: "2026-08-15" },
  { title: "Gandhi Jayanti", date: "2026-10-02" },
  { title: "Diwali", date: "2026-11-08" },
  { title: "Christmas Day", date: "2026-12-25" }
];

export default function MeetingCalendar({ onClose, readOnly }) {
  const [events, setEvents] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [momText, setMomText] = useState("");

  const user = JSON.parse(sessionStorage.getItem("user"));
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const canAssignCreator = user?.role === "super_admin" || (user?.role === "admin" && user?.department === "HR");
  const navigate = useNavigate();

  const handleBackToDashboard = () => {
   
    if (onClose) {
      onClose();
      return;
    }

    const storedUser = sessionStorage.getItem("user");
    if (!storedUser) {
      navigate("/login");
      return;
    }

    const role = JSON.parse(storedUser)?.role;

    const roleRoutes = {
      super_admin: "/super-admin-dashboard",
      admin: "/admin-dashboard",
      employee: "/employee-dashboard",
      intern: "/employee-dashboard",
    };

    navigate(roleRoutes[role] || "/employee-dashboard");
  };

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    meeting_date: "",
    start_time: "",
    end_time: "",
    meeting_link: "",
    assigned_creator: "",
    target_users: []
  });

  const toggleTargetUser = (userId) => {
    setFormData(prev => {
      const isSelected = prev.target_users.includes(userId);
      return {
        ...prev,
        target_users: isSelected 
          ? prev.target_users.filter(id => id !== userId) 
          : [...prev.target_users, userId]
      };
    });
  };

  const loadMeetings = async () => {
    try {
      setLoading(true);
      const res = await api.get("/meetings");
      const formatted = res.data.map(m => ({
        id: m.id,
        title: m.title,
        start: `${m.meeting_date.split("T")[0]}T${m.start_time}`,
        end: `${m.meeting_date.split("T")[0]}T${m.end_time}`,
        extendedProps: { ...m }
      }));

      const holidayEvents = PUBLIC_HOLIDAYS.map((h, i) => ({
        id: `holiday-${i}`,
        title: `🌴 ${h.title}`,
        start: h.date,
        allDay: true,
        display: "block",
        backgroundColor: "#dcfce7",
        borderColor: "#bbf7d0",
        textColor: "#166534",
        extendedProps: { isHoliday: true, status: "Holiday" }
      }));

      setEvents([...formatted, ...holidayEvents]);
    } catch (err) {
      console.error("Failed to load meetings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  useEffect(() => {
    api.get("/employees/all-assignable")
      .then(res => {
        const filtered = res.data.filter(u => u.id !== user?.id);
        setAllUsers(filtered);
      })
      .catch(err => console.error("Error fetching users:", err));
  }, []);

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    try {
      setBtnLoading(true);
      await api.post("/meetings", formData);
      setShowCreateForm(false);
      setFormData({
        title: "", description: "", meeting_date: "",
        start_time: "", end_time: "", meeting_link: "", assigned_creator: "", target_users: []
      });
      loadMeetings();
    } catch (err) {
      alert("Failed to create meeting");
    } finally {
      setBtnLoading(false);
    }
  };

  const handleStartMeeting = async (meetingId) => {
    if (readOnly) return;
    try {
      setBtnLoading(true);
      const res = await api.patch(`/meetings/${meetingId}/start`);
      setSelectedMeeting(res.data.meeting);
      loadMeetings();
      alert("Meeting started! Admins have been notified.");
    } catch (err) {
      alert("Failed to start meeting");
    } finally {
      setBtnLoading(false);
    }
  };

  const handleSaveMom = async () => {
    if (readOnly || !selectedMeeting) return;
    try {
      setBtnLoading(true);
      const res = await api.patch(`/meetings/${selectedMeeting.id}/mom`, { minutes_of_meeting: momText });
      setSelectedMeeting(res.data.meeting);
      loadMeetings();
      alert("Minutes of Meeting saved successfully!");
    } catch (err) {
      alert("Failed to save Minutes of Meeting");
    } finally {
      setBtnLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMeeting) {
      setMomText(selectedMeeting.minutes_of_meeting || "");
    }
  }, [selectedMeeting]);

  const renderEventContent = (eventInfo) => {
    if (eventInfo.event.extendedProps.isHoliday) {
      return (
        <div style={{ color: "#166534", fontWeight: "700", textAlign: "center", fontSize: "0.75rem", padding: "2px", whiteSpace: "normal", wordWrap: "break-word" }}>
          {eventInfo.event.title}
        </div>
      );
    }
    const status = eventInfo.event.extendedProps.status;
    return (
      <div className={`calendar-event-pills status-${status?.toLowerCase()}`}>
        <div className="event-main-title">{eventInfo.event.title}</div>
        <div className="event-organizer">👤 {eventInfo.event.extendedProps.creator_name || "—"}</div>
        <div className="event-sub-info">
          {status === "In Progress" ? " Ongoing" : " Scheduled"}
        </div>
      </div>
    );
  };

  return (
    <div className="calendar-view-container">
      <div className="calendar-header">
        <div className="cal-header-left">
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{
              width: 40, height: 40, background: "#ffffff", borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, overflow: "hidden", border: "1px solid #e2e8f0",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
            }}>
              <img
                src={import.meta.env.VITE_LOGO_URL || "/logo.jpg"}
                alt="Logo"
                style={{ width: 34, height: 34, objectFit: "contain" }}
                onError={(e) => {
                  if (e.target.src !== window.location.origin + "/logo.jpg") {
                    e.target.src = "/logo.jpg";
                  } else {
                    e.target.style.display = "none";
                  }
                }}
              />
            </div>
            <div>
              <h2 style={{ marginBottom: 2 }}>Meeting Schedule</h2>
              <p className="cal-header-sub">Coordinate with your team</p>
            </div>
          </div>
        </div>
        <div className="cal-header-actions">
          {!readOnly && (
            <button onClick={() => setShowCreateForm(true)} className="create-meeting-btn">
              + Schedule Meeting
            </button>
          )}
          <button onClick={loadMeetings} className="refresh-btn" title="Refresh">🔄</button>
          <button onClick={handleBackToDashboard} className="cal-close-btn" title="Close">✕</button>
        </div>
      </div>

      {loading ? (
        <div className="cal-loading-state">Syncing with server...</div>
      ) : (
        <FullCalendar
          plugins={[dayGridPlugin]}
          initialView="dayGridMonth"
          events={events}
          height="70vh"
          eventContent={renderEventContent}
          eventClick={(info) => setSelectedMeeting(info.event.extendedProps)}
        />
      )}

  
      {selectedMeeting && (
        <div className="task-modal-overlay" onClick={() => setSelectedMeeting(null)}>
          <div className="task-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3> Meeting Details</h3>
              <button className="close-x" onClick={() => setSelectedMeeting(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="meeting-detail-grid">
                <div className="detail-item">
                  <label>Title</label>
                  <div>{selectedMeeting.title}</div>
                </div>
                <div className="detail-item">
                  <label>Status</label>
                  <span className={`status-pill status-${selectedMeeting.status?.toLowerCase()}`}>
                    {selectedMeeting.status}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Organizer</label>
                  <div> {selectedMeeting.creator_name || "Unknown"}</div>
                </div>
                <div className="detail-item">
                  <label>Time</label>
                  <div>{selectedMeeting.start_time} - {selectedMeeting.end_time}</div>
                </div>
                <div className="detail-item">
                  <label>Meeting Link</label>
                  <div>
                    {selectedMeeting.meeting_link ? (
                      <a href={selectedMeeting.meeting_link} target="_blank" rel="noreferrer" className="meeting-join-link">
                        Join Meeting 🔗
                      </a>
                    ) : "No link provided"}
                  </div>
                </div>
              </div>
              {selectedMeeting.description && (
                <div className="detail-desc">
                  <label>Agenda</label>
                  <p>{selectedMeeting.description}</p>
                </div>
              )}

              {/* Minutes of Meeting Section */}
              <div className="detail-desc" style={{ marginTop: "16px", borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
                <label style={{ color: "#4f46e5", display: "flex", alignItems: "center", gap: "6px" }}>
                  📝 Minutes of Meeting
                </label>
                {readOnly ? (
                  <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", fontSize: "13px", minHeight: "60px", whiteSpace: "pre-wrap" }}>
                    {selectedMeeting.minutes_of_meeting || "No minutes of meeting recorded yet."}
                  </div>
                ) : (
                  <div>
                    <textarea 
                      value={momText}
                      onChange={(e) => setMomText(e.target.value)}
                      placeholder="Enter minutes of meeting, key takeaways, action items..."
                      rows="4"
                      style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "6px", fontSize: "13px", fontFamily: "inherit" }}
                    />
                    <div style={{ textAlign: "right", marginTop: "8px" }}>
                      <button 
                        onClick={handleSaveMom} 
                        disabled={btnLoading}
                        style={{ background: "#4f46e5", color: "white", border: "none", padding: "6px 14px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}
                      >
                        {btnLoading ? "Saving..." : "Save MoM"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
            <div className="modal-footer">
              {selectedMeeting.status === "Pending" && !readOnly && (
                <button
                  className="start-meeting-action-btn"
                  onClick={() => handleStartMeeting(selectedMeeting.id)}
                  disabled={btnLoading}
                >
                  {btnLoading ? "Processing..." : "▶️ Start Meeting"}
                </button>
              )}
              <button className="close-btn" onClick={() => setSelectedMeeting(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showCreateForm && (
        <div className="task-modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="task-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Schedule New Meeting</h3>
              <button className="close-x" onClick={() => setShowCreateForm(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateMeeting} className="modal-body meeting-form">

              {canAssignCreator && (
                <div className="form-group">
                  <label>Set Meeting Creator</label>
                  <select
                    value={formData.assigned_creator}
                    onChange={e => setFormData({ ...formData, assigned_creator: e.target.value })}
                  >
                    <option value="">— Default (Yourself) —</option>
                    {allUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.fullname} ({u.employee_uav_id || u.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Select Participants (Notify Admins / Users)</label>
                <div style={{ maxHeight: "140px", overflowY: "auto", border: "1px solid #e2e8f0", padding: "8px", borderRadius: "6px", background: "#f8fafc" }}>
                  {allUsers.length === 0 && <span style={{fontSize: "12px", color: "#64748b"}}>Loading users...</span>}
                  {allUsers.map(u => (
                    <label key={`target-${u.id}`} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", fontSize: "13px", cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={formData.target_users.includes(u.id)}
                        onChange={() => toggleTargetUser(u.id)}
                        style={{ cursor: "pointer", width: "14px", height: "14px" }}
                      />
                      {u.fullname} <span style={{color: "#64748b", fontSize: "12px"}}>({u.role}{u.department ? ` · ${u.department}` : ''})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Meeting Title</label>
                <input required type="text" value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Weekly Sync" />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Meeting agenda..." rows="3" />
              </div>

              <div className="form-group-row" style={{ display: "flex", gap: "10px" }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Date</label>
                  <input required type="date" value={formData.meeting_date}
                    min={new Date().toISOString().split("T")[0]}
                    max={new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split("T")[0]}
                    onChange={e => setFormData({ ...formData, meeting_date: e.target.value })} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Start Time</label>
                  <input required type="time" value={formData.start_time}
                    onChange={e => setFormData({ ...formData, start_time: e.target.value })} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>End Time</label>
                  <input required type="time" value={formData.end_time}
                    onChange={e => setFormData({ ...formData, end_time: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label>Meeting Link</label>
                <input type="url" value={formData.meeting_link}
                  onChange={e => setFormData({ ...formData, meeting_link: e.target.value })}
                  placeholder="e.g. Google Meet or Zoom link" />
              </div>

              <div className="modal-footer">
                <button type="submit" className="save-btn" disabled={btnLoading}>
                  {btnLoading ? "Scheduling..." : "Create Schedule"}
                </button>
                <button type="button" className="close-btn" onClick={() => setShowCreateForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}