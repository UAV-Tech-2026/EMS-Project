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

export default function MeetingCalendar({ onClose }) {
  const [events, setEvents] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [allUsers, setAllUsers] = useState([]);

  const user = JSON.parse(localStorage.getItem("user"));
  const isAdmin = user?.role === "super_admin" || user?.role === "admin" || user?.role === "admin_hr";
  const canAssignCreator = user?.role === "super_admin" || user?.role === "admin_hr";
  const navigate = useNavigate();

  const handleBackToDashboard = () => {
    // If onClose prop is provided, use it (e.g. when rendered inside a modal)
    if (onClose) {
      onClose();
      return;
    }

    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      navigate("/login");
      return;
    }

    const role = JSON.parse(storedUser)?.role;

    const roleRoutes = {
      super_admin: "/super-admin-dashboard",
      admin: "/admin-dashboard",
      admin_hr: "/admin-dashboard",
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
    assigned_creator: ""
  });

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
    if (canAssignCreator) {
      api.get("/employees/all-assignable")
        .then(res => {
          const filtered = res.data.filter(u => u.id !== user.id);
          setAllUsers(filtered);
        })
        .catch(err => console.error("Error fetching users:", err));
    }
  }, []);

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    try {
      setBtnLoading(true);
      await api.post("/meetings", formData);
      setShowCreateForm(false);
      setFormData({
        title: "", description: "", meeting_date: "",
        start_time: "", end_time: "", meeting_link: "", assigned_creator: ""
      });
      loadMeetings();
    } catch (err) {
      alert("Failed to create meeting");
    } finally {
      setBtnLoading(false);
    }
  };

  const handleStartMeeting = async (meetingId) => {
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
          {isAdmin && (
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

      {/* Detail Modal */}
      {selectedMeeting && (
        <div className="task-modal-overlay" onClick={() => setSelectedMeeting(null)}>
          <div className="task-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🤝 Meeting Details</h3>
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
            </div>
            <div className="modal-footer">
              {selectedMeeting.status === "Pending" && (
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

      {/* Create Meeting Modal */}
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
                    required
                    value={formData.assigned_creator}
                    onChange={e => setFormData({ ...formData, assigned_creator: e.target.value })}
                  >
                    <option value="">— Select User —</option>
                    {allUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.fullname} ({u.employee_uav_id || u.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
