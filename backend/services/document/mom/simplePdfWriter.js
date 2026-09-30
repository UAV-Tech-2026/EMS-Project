import fs from "fs";
import path from "path";

/**
 * Pure JavaScript PDF 1.4 Builder - Zero external dependencies.
 * Generates clean, formatted PDF documents for Document Templates / MOM.
 */
export function buildDocumentPdfBuffer(momData) {
  const title = momData.meeting_title || "Document Template";
  const dateStr = momData.meeting_date
    ? new Date(momData.meeting_date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "N/A";
  const duration = momData.meeting_duration || "1 Hour";
  const organizer = momData.organizer || "System User";
  const status = momData.status || "Generated";
  const docType = momData.document_type || "DOCUMENT TEMPLATE";

  // Parse attendees
  let attendeesList = [];
  try {
    const raw = typeof momData.attendees === "string" ? JSON.parse(momData.attendees) : momData.attendees;
    if (Array.isArray(raw)) {
      attendeesList = raw.map(att => typeof att === "string" ? att : (att.name || att.fullname || "Participant"));
    }
  } catch {
    attendeesList = [];
  }

  // Parse action items
  let actionItemsList = [];
  try {
    const raw = typeof momData.action_items === "string" ? JSON.parse(momData.action_items) : momData.action_items;
    if (Array.isArray(raw)) actionItemsList = raw;
  } catch {
    actionItemsList = [];
  }

  const agenda = momData.agenda || "No specific agenda specified.";
  const summary = momData.summary || "No discussion summary notes recorded.";

  // Sanitize text for PDF literal string (escape parens and backslashes)
  function pdfEscape(text) {
    if (!text) return "";
    return String(text)
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/[\r\n]+/g, " ");
  }

  // Wrap long text into lines of max ~80 chars
  function wrapText(text, maxChars = 75) {
    if (!text) return ["N/A"];
    const paragraphs = String(text).split(/\r?\n/);
    const lines = [];
    for (const para of paragraphs) {
      if (!para.trim()) continue;
      const words = para.trim().split(/\s+/);
      let currentLine = "";
      for (const w of words) {
        if ((currentLine + " " + w).length > maxChars) {
          if (currentLine) lines.push(currentLine);
          currentLine = w;
        } else {
          currentLine = currentLine ? currentLine + " " + w : w;
        }
      }
      if (currentLine) lines.push(currentLine);
    }
    return lines.length > 0 ? lines : ["N/A"];
  }

  // PDF Content Stream construction
  const streamCommands = [];

  // Helper for drawing text
  function addText(text, x, y, size = 11, font = "F1", color = [0.1, 0.1, 0.1]) {
    streamCommands.push(`r ${color[0]} ${color[1]} ${color[2]} rg`);
    streamCommands.push(`BT /${font} ${size} Tf ${x} ${y} Td (${pdfEscape(text)}) Tj ET`);
  }

  // Helper for drawing rectangle / line
  function addRect(x, y, w, h, fillColor = [0.95, 0.96, 0.98]) {
    streamCommands.push(`${fillColor[0]} ${fillColor[1]} ${fillColor[2]} rg`);
    streamCommands.push(`${x} ${y} ${w} ${h} re f`);
  }

  function addLine(x1, y1, x2, y2, color = [0.8, 0.85, 0.9], width = 1) {
    streamCommands.push(`${width} w ${color[0]} ${color[1]} ${color[2]} RG`);
    streamCommands.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  }

  let y = 780; // Start near top of A4 (842pt height)

  // 1. Header Banner
  addRect(40, 770, 515, 50, [0.12, 0.23, 0.37]); // Dark navy header
  addText("UAV-Tech WorkStockPro — Employee Management System", 55, 800, 14, "F2", [1, 1, 1]);
  addText(`OFFICIAL DOCUMENT TEMPLATE: ${pdfEscape(docType)}`, 55, 782, 10, "F1", [0.8, 0.88, 1]);

  y = 740;

  // 2. Title & ID
  addText(pdfEscape(title), 40, y, 18, "F2", [0.09, 0.18, 0.3]);
  y -= 20;
  addText(`Document ID: #${momData.id || "DRAFT"} | Status: ${pdfEscape(status)}`, 40, y, 10, "F1", [0.4, 0.45, 0.5]);
  y -= 15;

  addLine(40, y, 555, y, [0.2, 0.4, 0.6], 1.5);
  y -= 20;

  // 3. Metadata Table Grid
  addRect(40, y - 45, 515, 55, [0.96, 0.97, 0.99]);
  addLine(40, y + 10, 555, y + 10, [0.85, 0.9, 0.95]);

  addText("Date & Time:", 50, y - 5, 10, "F2", [0.2, 0.25, 0.35]);
  addText(pdfEscape(dateStr), 125, y - 5, 10, "F1", [0.1, 0.1, 0.1]);

  addText("Duration:", 320, y - 5, 10, "F2", [0.2, 0.25, 0.35]);
  addText(pdfEscape(duration), 380, y - 5, 10, "F1", [0.1, 0.1, 0.1]);

  addText("Organizer:", 50, y - 25, 10, "F2", [0.2, 0.25, 0.35]);
  addText(pdfEscape(organizer), 125, y - 25, 10, "F1", [0.1, 0.1, 0.1]);

  addText("Generated:", 320, y - 25, 10, "F2", [0.2, 0.25, 0.35]);
  addText(new Date().toLocaleDateString("en-IN"), 380, y - 25, 10, "F1", [0.1, 0.1, 0.1]);

  y -= 65;

  // 4. Section: Attendees
  addText("1. Attendees & Participants", 40, y, 12, "F2", [0.12, 0.23, 0.37]);
  y -= 15;
  const attendeesStr = attendeesList.length > 0 ? attendeesList.join(", ") : "None specified";
  const attendeeLines = wrapText(attendeesStr, 80);
  for (const line of attendeeLines) {
    addText(`•  ${pdfEscape(line)}`, 50, y, 10, "F1", [0.2, 0.2, 0.2]);
    y -= 14;
  }
  y -= 10;

  // 5. Section: Agenda
  addText("2. Agenda", 40, y, 12, "F2", [0.12, 0.23, 0.37]);
  y -= 15;
  const agendaLines = wrapText(agenda, 80);
  for (const line of agendaLines) {
    addText(pdfEscape(line), 50, y, 10, "F1", [0.2, 0.2, 0.2]);
    y -= 14;
  }
  y -= 10;

  // 6. Section: Discussion Summary / Notes
  addText("3. Discussion Summary & Notes", 40, y, 12, "F2", [0.12, 0.23, 0.37]);
  y -= 15;
  const summaryLines = wrapText(summary, 80);
  for (const line of summaryLines) {
    addText(pdfEscape(line), 50, y, 10, "F1", [0.2, 0.2, 0.2]);
    y -= 14;
  }
  y -= 10;

  // 7. Section: Action Items Table
  if (y < 150) y = 150; // Prevent overflow off page
  addText("4. Action Items & Assignments", 40, y, 12, "F2", [0.12, 0.23, 0.37]);
  y -= 18;

  // Action Items Table Header
  addRect(40, y - 5, 515, 20, [0.9, 0.93, 0.97]);
  addText("#", 45, y, 10, "F2", [0.1, 0.2, 0.3]);
  addText("Task Description", 70, y, 10, "F2", [0.1, 0.2, 0.3]);
  addText("Assignee", 360, y, 10, "F2", [0.1, 0.2, 0.3]);
  addText("Due Date", 480, y, 10, "F2", [0.1, 0.2, 0.3]);
  y -= 20;

  if (actionItemsList.length === 0) {
    addText("No specific action items recorded.", 50, y, 10, "F1", [0.5, 0.5, 0.5]);
    y -= 16;
  } else {
    actionItemsList.forEach((item, idx) => {
      const task = typeof item === "string" ? item : (item.task || item.description || "Action Item");
      const assignee = typeof item === "object" ? (item.assignee || item.owner || "Unassigned") : "Unassigned";
      const dueDate = typeof item === "object" ? (item.dueDate || item.due_date || "N/A") : "N/A";

      addText(`${idx + 1}`, 45, y, 9, "F1", [0.2, 0.2, 0.2]);
      addText(pdfEscape(task.slice(0, 50)), 70, y, 9, "F1", [0.2, 0.2, 0.2]);
      addText(pdfEscape(assignee.slice(0, 20)), 360, y, 9, "F1", [0.2, 0.2, 0.2]);
      addText(pdfEscape(dueDate.slice(0, 15)), 480, y, 9, "F1", [0.2, 0.2, 0.2]);
      y -= 16;
    });
  }

  // Footer Line
  addLine(40, 50, 555, 50, [0.8, 0.8, 0.8]);
  addText("© 2026 UAV-Tech WorkStockPro. All rights reserved.", 40, 35, 9, "F1", [0.5, 0.5, 0.5]);

  const contentStream = streamCommands.join("\n");
  const streamLength = Buffer.byteLength(contentStream, "ascii");

  // Construct PDF Objects
  const objects = [];
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`);
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources 5 0 R >>\nendobj`);
  objects.push(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream\nendobj`);
  objects.push(`5 0 obj\n<< /Font << /F1 6 0 R /F2 7 0 R >> >>\nendobj`);
  objects.push(`6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);
  objects.push(`7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj`);

  let pdfString = "%PDF-1.4\n";
  const xrefOffsets = [0]; // Dummy offset for object 0

  for (let i = 0; i < objects.length; i++) {
    xrefOffsets.push(Buffer.byteLength(pdfString, "ascii"));
    pdfString += objects[i] + "\n";
  }

  const xrefStart = Buffer.byteLength(pdfString, "ascii");
  pdfString += `xref\n0 ${objects.length + 1}\n`;
  pdfString += `0000000000 65535 f \n`;

  for (let i = 1; i <= objects.length; i++) {
    const offsetStr = String(xrefOffsets[i]).padStart(10, "0");
    pdfString += `${offsetStr} 00000 n \n`;
  }

  pdfString += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdfString += `startxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdfString, "ascii");
}
