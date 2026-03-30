import React, { useState, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid/index.js";
import { api } from "../utils/api";
import "../styles/TaskCalender.css";

export default function TaskCalendar({ onClose }) {
  const [events, setEvents]             = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);

  const loadTasks = async () => {
    try {
      const res = await api.get("/tasks/calendar-events");
      setEvents(res.data);
    } catch (err) {
      console.error("Error loading calendar events", err);
    }
  };

  useEffect(() => { loadTasks(); }, []);

  const renderEventContent = (eventInfo) => {
    const { fullname, priority } = eventInfo.event.extendedProps;
    const fullTitle  = eventInfo.event.title;
    const shortTitle = fullTitle.length > 14 ? fullTitle.substring(0, 14) + "…" : fullTitle;
    return (
      <div className={`calendar-event-pills priority-${priority?.toLowerCase() || "medium"}`}>
        <div className="event-main-title">{shortTitle}</div>
        <div className="event-user">👤 {fullname || "Staff"}</div>
      </div>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric"
    });
  };

  return (
    <div className="calendar-view-container">
      
      <div className="calendar-header">
        <h2>Employee Task Schedule</h2>
        <div className="cal-header-actions">
          <button onClick={loadTasks} className="refresh-btn">🔄 Refresh</button>
          {onClose && (
            <button onClick={onClose} className="cal-close-btn">✕</button>
          )}
        </div>
      </div>

      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        events={events}
        height="70vh"
        eventContent={renderEventContent}
        dayMaxEvents={3}
        moreLinkText={(n) => `+${n} more`}
        headerToolbar={{
          left:   "title",
          center: "",
          right:  "prev,next today"
        }}
        eventClick={(info) => {
          setSelectedTask({
            title: info.event.title,
            start: info.event.startStr,
            ...info.event.extendedProps
          });
        }}
      />

      {selectedTask && (
        <div className="task-modal-overlay" onClick={() => setSelectedTask(null)}>
          <div className="task-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 Task Details</h3>
              <button className="close-x" onClick={() => setSelectedTask(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p><strong>📌 Title:</strong> {selectedTask.title}</p>
              <p><strong>👤 Assigned To:</strong> {selectedTask.fullname || "Not assigned"}</p>
              <p><strong>📅 Due Date:</strong> {formatDate(selectedTask.start)}</p>
              <p>
                <strong>🎯 Priority:</strong>
                <span className={`priority-tag priority-${selectedTask.priority?.toLowerCase()}`}>
                  {selectedTask.priority || "Medium"}
                </span>
              </p>
              {selectedTask.description && (
                <p><strong>📝 Description:</strong> {selectedTask.description}</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="close-btn" onClick={() => setSelectedTask(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
