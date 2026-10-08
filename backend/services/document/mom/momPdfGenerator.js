import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { fileURLToPath } from "url";
import { buildDocumentPdfBuffer } from "./simplePdfWriter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sanitize user inputs for LaTeX to prevent syntax breaks and injection
function sanitizeLatex(str) {
  if (!str) return "";
  return String(str)
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/&/g, "\\&")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/"([^"]*)"/g, "``$1''");
}

export async function generateMomPdf(momData) {
  const uploadsDir = path.join(process.cwd(), "uploads", "moms");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const pdfFileName = `mom_${momData.id || Date.now()}.pdf`;
  const finalPdfPath = path.join(uploadsDir, pdfFileName);
  const relativePdfPath = `uploads/moms/${pdfFileName}`;

  // Helper function to write PDF using pure-JS fallback
  const fallbackGenerate = () => {
    try {
      console.log(`[PDF] Using pure-JS PDF generator for document #${momData.id || "draft"}`);
      const pdfBuffer = buildDocumentPdfBuffer(momData);
      fs.writeFileSync(finalPdfPath, pdfBuffer);
      return {
        fullPath: finalPdfPath,
        relativeUrl: relativePdfPath,
        pdfName: pdfFileName
      };
    } catch (fallbackErr) {
      console.error("[PDF] Pure-JS Fallback PDF generation failed:", fallbackErr);
      throw fallbackErr;
    }
  };

  const templatePath = path.join(process.cwd(), "templates", "mom", "meeting_minutes_template.tex");
  
  if (!fs.existsSync(templatePath)) {
    return fallbackGenerate();
  }

  let templateContent = fs.readFileSync(templatePath, "utf8");

  // Format Date
  let meetingDateStr = "N/A";
  if (momData.meeting_date) {
    try {
      const d = new Date(momData.meeting_date);
      if (!isNaN(d.getTime())) {
        meetingDateStr = d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      } else {
        meetingDateStr = String(momData.meeting_date);
      }
    } catch {
      meetingDateStr = String(momData.meeting_date);
    }
  }

  // Format Attendees
  let attendeesRaw = momData.attendees;
  if (typeof attendeesRaw === "string") {
    try { attendeesRaw = JSON.parse(attendeesRaw); } catch { attendeesRaw = [attendeesRaw]; }
  }
  const attendeesList = Array.isArray(attendeesRaw) ? attendeesRaw : [];
  let attendeesItems = "";
  if (attendeesList.length === 0) {
    attendeesItems = "\\item N/A";
  } else {
    attendeesItems = attendeesList.map(att => {
      let name = typeof att === "string" ? att : (att.name || att.fullname || "Participant");
      let sanitized = sanitizeLatex(name);
      if (sanitized.includes("(Attended)")) {
        sanitized = sanitized.replace(/\(Attended\)/g, "(\\textbf{Attended})");
      }
      return `\\item ${sanitized}`;
    }).join("\n");
  }

  // Format Agenda
  let agendaRaw = momData.agenda || "No specific agenda specified.";
  let agendaLines = agendaRaw.split(/\r?\n/).filter(l => l.trim().length > 0);
  let agendaItems = "";
  if (agendaLines.length === 0) {
    agendaItems = "\\item No specific agenda specified.";
  } else {
    agendaItems = agendaLines.map(line => {
      let cleaned = line.trim().replace(/^[-*•\d+.\s]+/, "");
      return `\\item ${sanitizeLatex(cleaned)}`;
    }).join("\n");
  }

  // Format Summary
  let summaryRaw = momData.summary || "No discussion summary notes recorded.";
  let summaryLines = summaryRaw.split(/\r?\n/).filter(l => l.trim().length > 0);
  let summaryItems = "";
  if (summaryLines.length === 0) {
    summaryItems = "\\item No discussion summary notes recorded.";
  } else {
    summaryItems = summaryLines.map(line => {
      let cleaned = line.trim().replace(/^[-*•\d+.\s]+/, "");
      return `\\item ${sanitizeLatex(cleaned)}`;
    }).join("\n");
  }

  // Format Action Items
  let actionItemsRaw = momData.action_items;
  if (typeof actionItemsRaw === "string") {
    try { actionItemsRaw = JSON.parse(actionItemsRaw); } catch { actionItemsRaw = []; }
  }
  let actionItemsContent = "";
  if (Array.isArray(actionItemsRaw) && actionItemsRaw.length > 0) {
    const itemsList = actionItemsRaw.map(item => {
      if (typeof item === "string") return `\\item ${sanitizeLatex(item)}`;
      const task = sanitizeLatex(item.task || item.description || "Action Item");
      const assignee = sanitizeLatex(item.assignee || item.owner || "");
      const dueDate = sanitizeLatex(item.dueDate || item.due_date || "");
      let meta = [];
      if (assignee) meta.push(`\\textbf{Assignee}: ${assignee}`);
      if (dueDate) meta.push(`\\textbf{Due}: ${dueDate}`);
      const metaStr = meta.length > 0 ? ` (${meta.join(", ")})` : "";
      return `\\item ${task}${metaStr}`;
    }).join("\n");
    actionItemsContent = `\\begin{enumerate}[leftmargin=1.5em, nosep, topsep=4pt, bottomsep=4pt]\n${itemsList}\n\\end{enumerate}`;
  } else {
    let rawText = typeof momData.action_items === "string" ? momData.action_items.trim() : "";
    if (rawText && rawText !== "[]") {
      actionItemsContent = `\\vspace{2pt} ${sanitizeLatex(rawText)} \\vspace{2pt}`;
    } else {
      actionItemsContent = `\\vspace{2pt} No action items recorded for this meeting. \\vspace{2pt}`;
    }
  }

  // Perform LaTeX Substitutions
  templateContent = templateContent
    .replace(/\{\{MEETING_TITLE\}\}/g, sanitizeLatex(momData.meeting_title || "Untitled Meeting"))
    .replace(/\{\{MEETING_DATE\}\}/g, sanitizeLatex(meetingDateStr))
    .replace(/\{\{MEETING_DURATION\}\}/g, sanitizeLatex(momData.meeting_duration || "1 Hour"))
    .replace(/\{\{ORGANIZER\}\}/g, sanitizeLatex(momData.organizer || "System User"))
    .replace(/\{\{ATTENDEES_ITEMS\}\}/g, attendeesItems)
    .replace(/\{\{AGENDA_ITEMS\}\}/g, agendaItems)
    .replace(/\{\{SUMMARY_ITEMS\}\}/g, summaryItems)
    .replace(/\{\{ACTION_ITEMS_CONTENT\}\}/g, actionItemsContent);

  // Isolate compilation in temporary scratch folder
  const tempDir = path.join(process.cwd(), "scratch", `mom_${momData.id || Date.now()}`);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Copy logo into tempDir for LaTeX \includegraphics
  const rootLogoPath = path.join(process.cwd(), "logo.png");
  const publicLogoPath = path.join(process.cwd(), "frontend", "public", "logo.jpg");
  if (fs.existsSync(rootLogoPath)) {
    fs.copyFileSync(rootLogoPath, path.join(tempDir, "logo.png"));
  } else if (fs.existsSync(publicLogoPath)) {
    fs.copyFileSync(publicLogoPath, path.join(tempDir, "logo.png"));
  }

  const texFilePath = path.join(tempDir, "document.tex");
  fs.writeFileSync(texFilePath, templateContent, "utf8");

  // Check pdflatex paths
  const pdflatexCandidates = [
    "C:\\MiKTeX\\miktex\\bin\\x64\\pdflatex.exe",
    "C:\\Users\\Dell\\AppData\\Local\\Programs\\MiKTeX\\miktex\\bin\\x64\\pdflatex.exe",
    "pdflatex"
  ];

  let latexBinary = "pdflatex";
  for (const cand of pdflatexCandidates) {
    if (cand !== "pdflatex" && fs.existsSync(cand)) {
      latexBinary = cand;
      break;
    }
  }

  return new Promise((resolve) => {
    execFile(
      latexBinary,
      ["-interaction=nonstopmode", "-disable-installer", "-output-directory", tempDir, texFilePath],
      { timeout: 30000 },
      (error, stdout, stderr) => {
        const tempPdfPath = path.join(tempDir, "document.pdf");

        if (fs.existsSync(tempPdfPath)) {
          fs.copyFileSync(tempPdfPath, finalPdfPath);
          fs.rm(tempDir, { recursive: true, force: true }, () => {});

          return resolve({
            fullPath: finalPdfPath,
            relativeUrl: relativePdfPath,
            pdfName: pdfFileName
          });
        }

        console.warn("[PDF] pdflatex compilation failed or missing output. Falling back to JS generator:", stderr || error?.message);
        fs.rm(tempDir, { recursive: true, force: true }, () => {});
        resolve(fallbackGenerate());
      }
    );
  });
}
