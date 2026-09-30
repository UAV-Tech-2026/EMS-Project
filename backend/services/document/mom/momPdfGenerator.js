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
    .replace(/\^/g, "\\textasciicircum{}");
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

  // Format Attendees
  const attendeesList = Array.isArray(momData.attendees) ? momData.attendees : [];
  let attendeesRows = "";
  if (attendeesList.length === 0) {
    attendeesRows = `1 & N/A \\\\ \\hline`;
  } else {
    attendeesRows = attendeesList.map((att, idx) => {
      const name = typeof att === "string" ? att : (att.name || att.fullname || "Participant");
      return `${idx + 1} & ${sanitizeLatex(name)} \\\\ \\hline`;
    }).join("\n");
  }

  // Format Agenda
  const agendaRaw = momData.agenda || "No specific agenda specified.";
  const agendaSanitized = sanitizeLatex(agendaRaw).replace(/\n/g, "\n\n");

  // Format Summary
  const summaryRaw = momData.summary || "No discussion summary notes recorded.";
  const summarySanitized = sanitizeLatex(summaryRaw).replace(/\n/g, "\n\n");

  // Format Action Items
  const actionItemsList = Array.isArray(momData.action_items) ? momData.action_items : [];
  let actionItemsRows = "";
  if (actionItemsList.length === 0) {
    actionItemsRows = `1 & No action items recorded & N/A & N/A \\\\ \\hline`;
  } else {
    actionItemsRows = actionItemsList.map((item, idx) => {
      const task = sanitizeLatex(item.task || item.description || "Action Item");
      const assignee = sanitizeLatex(item.assignee || item.owner || "Unassigned");
      const dueDate = sanitizeLatex(item.dueDate || item.due_date || "N/A");
      return `${idx + 1} & ${task} & ${assignee} & ${dueDate} \\\\ \\hline`;
    }).join("\n");
  }

  // Perform LaTeX Substitutions
  const meetingDateStr = momData.meeting_date ? new Date(momData.meeting_date).toLocaleString("en-IN", {
    dateStyle: "medium", timeStyle: "short"
  }) : "N/A";

  const generatedDateStr = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  templateContent = templateContent
    .replace(/\{\{MEETING_TITLE\}\}/g, sanitizeLatex(momData.meeting_title || "Untitled Meeting"))
    .replace(/\{\{MOM_ID\}\}/g, sanitizeLatex(String(momData.id || "DRAFT")))
    .replace(/\{\{MEETING_DATE\}\}/g, sanitizeLatex(meetingDateStr))
    .replace(/\{\{MEETING_DURATION\}\}/g, sanitizeLatex(momData.meeting_duration || "1 Hour"))
    .replace(/\{\{ORGANIZER\}\}/g, sanitizeLatex(momData.organizer || "System User"))
    .replace(/\{\{GENERATED_DATE\}\}/g, sanitizeLatex(generatedDateStr))
    .replace(/\{\{ATTENDEES_ROWS\}\}/g, attendeesRows)
    .replace(/\{\{AGENDA_CONTENT\}\}/g, agendaSanitized)
    .replace(/\{\{SUMMARY_CONTENT\}\}/g, summarySanitized)
    .replace(/\{\{ACTION_ITEMS_ROWS\}\}/g, actionItemsRows)
    .replace(/\{\{STATUS\}\}/g, sanitizeLatex(momData.status || "Generated"));

  // Isolate compilation in temporary scratch folder
  const tempDir = path.join(process.cwd(), "scratch", `mom_${momData.id || Date.now()}`);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const texFilePath = path.join(tempDir, "document.tex");
  fs.writeFileSync(texFilePath, templateContent, "utf8");

  // Check pdflatex paths
  const pdflatexCandidates = [
    "C:\\MiKTeX\\miktex\\bin\\x64\\pdflatex.exe",
    "C:\\Users\\Dell\\AppData\\Local\\Programs\\MiKTeX\\miktex\\bin\\x64\\pdflatex.exe",
    "pdflatex"
  ];

  let latexBinary = null;
  for (const cand of pdflatexCandidates) {
    if (cand !== "pdflatex" && fs.existsSync(cand)) {
      latexBinary = cand;
      break;
    }
  }

  // If pdflatex is not installed on system, immediately use pure-JS fallback
  if (!latexBinary) {
    return fallbackGenerate();
  }

  return new Promise((resolve) => {
    execFile(
      latexBinary,
      ["-interaction=nonstopmode", "-output-directory", tempDir, texFilePath],
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
