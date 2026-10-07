import fs from "fs";
import path from "path";

/**
 * Pure JavaScript PDF 1.4 Builder - Zero external dependencies.
 * Generates clean, formatted PDF documents for Document Templates / MOM.
 * Formatted to match team lead exact specification:
 * Black top banner, Meeting Minutes header, UAV Logo, orange/copper section boxes.
 */
export function buildDocumentPdfBuffer(momData) {
  const title = momData.meeting_title || "WorkStock-Pro";
  
  let dateStr = "N/A";
  if (momData.meeting_date) {
    try {
      const d = new Date(momData.meeting_date);
      if (!isNaN(d.getTime())) {
        dateStr = d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      } else {
        dateStr = String(momData.meeting_date);
      }
    } catch {
      dateStr = String(momData.meeting_date);
    }
  }

  const duration = momData.meeting_duration || "04:00 PM to 04:40 PM";
  const organizer = momData.organizer || "Dr. R Sabari Vihar";

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

  const agenda = momData.agenda || "Add the \"Performance Index\" feature and carry out some modifications.";
  const summary = momData.summary || "1. Added the \"Performance Index\" feature.\n2. Verified Git branching.\n3. Determined how to revert to previous versions in GitHub and Docker Hub.\n4. Backed up the instances.\n5. Researched the testing environment: we build a Docker image and push it to Docker Hub, from where the development environment can pull it. Is this correct?\n6. From now on, all code pushes will be made from the company's GitHub.\n7. Git credentials need to be obtained from Vihar.\n8. Need to do research about the AI market study.";

  // Sanitize text for PDF literal string
  function pdfEscape(text) {
    if (!text) return "";
    return String(text)
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/[\r\n]+/g, " ");
  }

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

  const streamCommands = [];

  function addText(text, x, y, size = 11, font = "F1", color = [0.1, 0.1, 0.1]) {
    streamCommands.push(`r ${color[0]} ${color[1]} ${color[2]} rg`);
    streamCommands.push(`BT /${font} ${size} Tf ${x} ${y} Td (${pdfEscape(text)}) Tj ET`);
  }

  function addRect(x, y, w, h, fillColor = [0.95, 0.96, 0.98]) {
    streamCommands.push(`${fillColor[0]} ${fillColor[1]} ${fillColor[2]} rg`);
    streamCommands.push(`${x} ${y} ${w} ${h} re f`);
  }

  function addBorderBox(x, y, w, h, borderColor = [0.85, 0.45, 0.1], width = 1) {
    streamCommands.push(`${width} w ${borderColor[0]} ${borderColor[1]} ${borderColor[2]} RG`);
    streamCommands.push(`${x} ${y} ${w} ${h} re S`);
  }

  function addLine(x1, y1, x2, y2, color = [0.85, 0.45, 0.1], width = 1) {
    streamCommands.push(`${width} w ${color[0]} ${color[1]} ${color[2]} RG`);
    streamCommands.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  }

  let y = 780;

  // 1. Black Header Banner matching screenshot
  addRect(40, 770, 515, 45, [0.12, 0.12, 0.12]);
  addText("Meeting Minutes", 55, 786, 20, "F2", [1, 1, 1]);
  addText("[ YOUR LOGO ]", 460, 788, 10, "F1", [1, 1, 1]);

  y = 745;

  // 2. Meeting Summary Heading
  addText("Meeting Summary", 40, y, 14, "F2", [0.1, 0.1, 0.1]);
  y -= 25;

  // 3. Grid Table with Orange Border (#d97706 / [0.85, 0.45, 0.1])
  const gridTop = y;
  const gridWidth = 515;

  const attLines = attendeesList.length > 0
    ? attendeesList.map(a => `• ${a}`)
    : ["• N/A"];

  const attHeight = Math.max(30, attLines.length * 16 + 10);
  const gridTotalHeight = 110 + attHeight;

  addBorderBox(40, gridTop - gridTotalHeight, gridWidth, gridTotalHeight, [0.85, 0.45, 0.1], 1);
  addLine(160, gridTop, 160, gridTop - gridTotalHeight, [0.85, 0.45, 0.1], 1);

  // Row 1: Date and Time
  let currentY = gridTop - 20;
  addText("Date and Time", 48, currentY, 10, "F2", [0.1, 0.1, 0.1]);
  addText(pdfEscape(dateStr), 170, currentY, 10, "F1", [0.2, 0.2, 0.2]);
  addLine(40, gridTop - 28, 555, gridTop - 28, [0.85, 0.45, 0.1], 1);

  // Row 2: Meeting title
  currentY = gridTop - 45;
  addText("Meeting title", 48, currentY, 10, "F2", [0.1, 0.1, 0.1]);
  addText(pdfEscape(title), 170, currentY, 10, "F1", [0.2, 0.2, 0.2]);
  addLine(40, gridTop - 53, 555, gridTop - 53, [0.85, 0.45, 0.1], 1);

  // Row 3: Meeting Duration
  currentY = gridTop - 70;
  addText("Meeting Duration", 48, currentY, 10, "F2", [0.1, 0.1, 0.1]);
  addText(pdfEscape(duration), 170, currentY, 10, "F1", [0.2, 0.2, 0.2]);
  addLine(40, gridTop - 78, 555, gridTop - 78, [0.85, 0.45, 0.1], 1);

  // Row 4: Meeting Organizer
  currentY = gridTop - 95;
  addText("Meeting Organizer", 48, currentY, 10, "F2", [0.1, 0.1, 0.1]);
  addText(pdfEscape(organizer), 170, currentY, 10, "F1", [0.2, 0.2, 0.2]);
  addLine(40, gridTop - 103, 555, gridTop - 103, [0.85, 0.45, 0.1], 1);

  // Row 5: Attendees
  currentY = gridTop - 120;
  addText("Attendees", 48, currentY, 10, "F2", [0.1, 0.1, 0.1]);
  attLines.forEach((attLine) => {
    addText(pdfEscape(attLine), 170, currentY, 10, "F1", [0.2, 0.2, 0.2]);
    currentY -= 16;
  });

  y = gridTop - gridTotalHeight - 20;

  // 4. Agenda Box
  const agendaLines = wrapText(agenda, 85);
  const agendaHeight = agendaLines.length * 16 + 30;
  addBorderBox(40, y - agendaHeight, gridWidth, agendaHeight, [0.85, 0.45, 0.1], 1);
  addText("Agenda", 270, y - 18, 11, "F2", [0.1, 0.1, 0.1]);
  addLine(40, y - 24, 555, y - 24, [0.85, 0.45, 0.1], 1);

  let agY = y - 38;
  agendaLines.forEach((l) => {
    addText(`• ${pdfEscape(l)}`, 48, agY, 10, "F1", [0.2, 0.2, 0.2]);
    agY -= 16;
  });

  y -= (agendaHeight + 18);

  // 5. Summary Box
  const summaryLines = wrapText(summary, 85);
  const summaryHeight = summaryLines.length * 16 + 30;
  addBorderBox(40, y - summaryHeight, gridWidth, summaryHeight, [0.85, 0.45, 0.1], 1);
  addText("Summary", 265, y - 18, 11, "F2", [0.1, 0.1, 0.1]);
  addLine(40, y - 24, 555, y - 24, [0.85, 0.45, 0.1], 1);

  let sumY = y - 38;
  summaryLines.forEach((l) => {
    addText(pdfEscape(l), 48, sumY, 10, "F1", [0.2, 0.2, 0.2]);
    sumY -= 16;
  });

  y -= (summaryHeight + 18);

  // 6. Action Items Box
  const actionItemsHeight = 45;
  addBorderBox(40, y - actionItemsHeight, gridWidth, actionItemsHeight, [0.85, 0.45, 0.1], 1);
  addText("Action Items", 255, y - 16, 11, "F2", [0.1, 0.1, 0.1]);
  addLine(40, y - 22, 555, y - 22, [0.85, 0.45, 0.1], 1);

  if (actionItemsList.length === 0) {
    addText("No action items recorded for this meeting.", 48, y - 36, 10, "F1", [0.3, 0.3, 0.3]);
  } else {
    const actStr = actionItemsList.map(a => typeof a === "string" ? a : (a.task || "Task")).join("; ");
    addText(pdfEscape(actStr), 48, y - 36, 10, "F1", [0.2, 0.2, 0.2]);
  }

  const contentStream = streamCommands.join("\n");
  const streamLength = Buffer.byteLength(contentStream, "ascii");

  const objects = [];
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`);
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources 5 0 R >>\nendobj`);
  objects.push(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream\nendobj`);
  objects.push(`5 0 obj\n<< /Font << /F1 6 0 R /F2 7 0 R >> >>\nendobj`);
  objects.push(`6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>\nendobj`);
  objects.push(`7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>\nendobj`);

  let pdfString = "%PDF-1.4\n";
  const xrefOffsets = [0];

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
