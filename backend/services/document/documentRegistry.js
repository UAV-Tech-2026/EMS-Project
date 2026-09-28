import { generateMomPdf } from "./mom/momPdfGenerator.js";

const documentGenerators = {
  MOM: generateMomPdf,
  // Future document generators can be registered here seamlessly:
  // PROJECT_REPORT: generateProjectReportPdf,
  // DAILY_REPORT: generateDailyReportPdf,
  // WEEKLY_REPORT: generateWeeklyReportPdf,
  // MEETING_REPORT: generateMeetingReportPdf,
};

export async function generateDocumentPdf(docType, docData) {
  const generator = documentGenerators[docType?.toUpperCase()];
  if (!generator) {
    throw new Error(`No PDF generator registered for document type: ${docType}`);
  }
  return await generator(docData);
}

export function getSupportedDocumentTypes() {
  return [
    { id: "MOM", label: "MOM - Minutes of Meeting", available: true },
    { id: "PROJECT_REPORT", label: "Project Report (Coming Soon)", available: false },
    { id: "DAILY_REPORT", label: "Daily Report (Coming Soon)", available: false },
    { id: "WEEKLY_REPORT", label: "Weekly Report (Coming Soon)", available: false },
    { id: "MEETING_REPORT", label: "Meeting Report (Coming Soon)", available: false },
  ];
}
