import zlib from "zlib";

/**
 * Robustly extracts readable text from PDF buffers
 */
export function extractTextFromPdfBuffer(buffer) {
  try {
    const pdfString = buffer.toString("binary");
    let extractedText = "";

    // 1. Find all stream content
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let match;

    while ((match = streamRegex.exec(pdfString)) !== null) {
      let streamData = match[1];
      let decodedText = "";

      // Try uncompressing if FlateDecode (standard inflate + raw inflate fallback)
      try {
        const streamBuffer = Buffer.from(streamData, "binary");
        try {
          decodedText = zlib.inflateSync(streamBuffer).toString("utf8");
        } catch {
          decodedText = zlib.inflateRawSync(streamBuffer).toString("utf8");
        }
      } catch {
        decodedText = streamData;
      }

      // Extract text inside PDF parentheses e.g. (Text) Tj or [(T)-10(ext)] TJ
      const textMatches = decodedText.match(/\(([^()]*)\)\s*(?:Tj|TJ|'|")/g);
      if (textMatches) {
        for (const tm of textMatches) {
          const inner = tm.replace(/\)\s*(?:Tj|TJ|'|")/, "").replace(/^\(/, "");
          if (inner.trim()) {
            extractedText += inner.trim() + " ";
          }
        }
        extractedText += "\n";
      } else {
        // Fallback: match array TJ formats e.g. [ (Text1) 20 (Text2) ] TJ
        const arrayTJMatches = decodedText.match(/\[\s*(?:\([^()]*\)\s*[-0-9\s]*)+\]\s*TJ/g);
        if (arrayTJMatches) {
          for (const arr of arrayTJMatches) {
            const parts = arr.match(/\(([^()]*)\)/g);
            if (parts) {
              const line = parts.map(p => p.slice(1, -1)).join("");
              if (line.trim()) extractedText += line.trim() + " ";
            }
          }
          extractedText += "\n";
        }
      }
    }

    // 2. Fallback: Direct regex on binary string if stream parsing gave short output
    if (!extractedText || extractedText.trim().length < 20) {
      const rawMatches = pdfString.match(/\(([^()]{2,})\)\s*(?:Tj|TJ|'|")/g);
      if (rawMatches) {
        extractedText = rawMatches.map(m => m.replace(/\)\s*(?:Tj|TJ|'|")/, "").replace(/^\(/, "")).join(" ");
      }
    }

    // 3. Fallback: Extract printable ASCII strings of 3+ chars
    if (!extractedText || extractedText.trim().length < 20) {
      const printableMatches = pdfString.match(/[\x20-\x7E]{3,}/g);
      if (printableMatches) {
        extractedText = printableMatches.join(" ");
      }
    }

    return extractedText;
  } catch (err) {
    console.error("Error extracting text from PDF buffer:", err.message);
    return "";
  }
}

/**
 * Helper to match user by Employee Code or Fullname
 */
function matchUser(empCode, empName, usersList) {
  if (!usersList || !usersList.length) return null;

  const cleanCode = empCode ? String(empCode).trim().toUpperCase() : "";
  const numCode = cleanCode.replace(/\D/g, "");
  const cleanName = empName ? String(empName).trim().toLowerCase() : "";

  for (const u of usersList) {
    const uCode = u.employee_uav_id ? String(u.employee_uav_id).trim().toUpperCase() : "";
    const uNumCode = uCode.replace(/\D/g, "");
    const uName = u.fullname ? String(u.fullname).trim().toLowerCase() : "";

    // 1. Exact employee UAV ID match
    if (cleanCode && uCode && cleanCode === uCode) return u;

    // 2. Numeric code match
    if (numCode && numCode.length >= 2 && uNumCode && (numCode === uNumCode || uNumCode.endsWith(numCode))) {
      return u;
    }

    // 3. Exact name match
    if (cleanName && uName && cleanName === uName) return u;
  }

  // 4. Soft fullname match
  if (cleanName && cleanName.length >= 3) {
    for (const u of usersList) {
      const uName = u.fullname ? String(u.fullname).trim().toLowerCase() : "";
      if (uName && (uName.includes(cleanName) || cleanName.includes(uName))) return u;
    }
  }

  // 5. Fallback if only 1 user exists in system
  if (usersList.length === 1 && (cleanCode || cleanName)) {
    return usersList[0];
  }

  return null;
}

/**
 * Standardize leave / attendance status
 */
function normalizeStatus(rawStatus) {
  if (!rawStatus) return "Present";
  const s = String(rawStatus).trim().toUpperCase();

  if (["CL", "CASUAL LEAVE", "CASUAL"].includes(s)) return "CL";
  if (["ML", "SL", "MEDICAL LEAVE", "SICK LEAVE", "MEDICAL", "SICK"].includes(s)) return "ML";
  if (["PL", "EL", "PAID LEAVE", "EARNED LEAVE"].includes(s)) return "PL";
  if (["LOP", "LOSS OF PAY", "UNPAID"].includes(s)) return "LOP";
  if (["HD", "HALF DAY", "HALF", "0.5"].includes(s)) return "Half Day";
  if (["P", "PRESENT"].includes(s)) return "Present";
  if (["A", "ABSENT"].includes(s)) return "Absent";
  if (["WO", "OFF", "WEEKLY OFF"].includes(s)) return "Weekly Off";
  if (["HOL", "HOLIDAY"].includes(s)) return "Holiday";
  if (["FIELD WORK", "FIELDWORK", "FW"].includes(s)) return "Field Work";
  if (["CCL"].includes(s)) return "CCL";

  return s;
}

/**
 * Parse PDF Buffer into structured Attendance & Leave Records
 */
export function parseAttendancePdf(buffer, usersList = []) {
  const extractedText = extractTextFromPdfBuffer(buffer);
  const records = [];
  if (!extractedText) return records;

  const lines = extractedText.split(/[\r\n]+/);
  const todayStr = new Date().toISOString().split("T")[0];

  // RegEx patterns
  const dateRegex = /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/;
  const statusRegex = /\b(Casual Leave|Medical Leave|Sick Leave|Paid Leave|Loss of Pay|Half Day|Field Work|Present|Absent|CL|ML|SL|PL|LOP|HD|CCL|FW|P|A|0\.5)\b/i;

  for (const line of lines) {
    if (!line.trim()) continue;

    let matchedUser = null;
    let empCodeFound = "";

    // Match employee UAV ID code pattern (e.g. UAV001, EMP001, UTPLA001, UTPLS001, UTPLI001)
    const codeMatch = line.match(/\b([A-Z]{3,6}\d{1,6}|[A-Z0-9]{3,12}\d{1,6})\b/i);
    if (codeMatch) {
      empCodeFound = codeMatch[1];
      matchedUser = matchUser(empCodeFound, "", usersList);
    }

    if (!matchedUser) {
      // Try matching by employee name inside line
      for (const u of usersList) {
        if (u.fullname && u.fullname.length >= 3 && line.toLowerCase().includes(u.fullname.toLowerCase())) {
          matchedUser = u;
          break;
        }
      }
    }

    // Fallback: If lines have dates and status but no explicit user match, try matching any available user or usersList[0]
    if (!matchedUser && (dateRegex.test(line) || statusRegex.test(line))) {
      if (usersList.length > 0) {
        matchedUser = usersList[0];
      }
    }

    if (!matchedUser) continue;

    // Parse date from line (handles YYYY-MM-DD, DD-MM-YYYY, DD-MM-YY)
    let dateStr = todayStr;
    const dateMatch = line.match(dateRegex);
    if (dateMatch) {
      const rawDate = dateMatch[1];
      const parts = rawDate.split(/[-/]/);
      if (parts[0].length === 4) {
        dateStr = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
      } else if (parts[2]?.length === 4) {
        dateStr = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      } else if (parts[2]?.length === 2) {
        const yr = Number(parts[2]) > 50 ? "19" + parts[2] : "20" + parts[2];
        dateStr = `${yr}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
    }

    // Parse status from line
    let status = "Present";
    const stMatch = line.match(statusRegex);
    if (stMatch) {
      status = normalizeStatus(stMatch[1]);
    }

    // Parse check in / out times if available e.g. 09:15 18:30
    const times = line.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g);
    const checkIn = times && times[0] ? times[0] : null;
    const checkOut = times && times[1] ? times[1] : null;

    records.push({
      userId: matchedUser.id,
      empId: matchedUser.employee_uav_id || empCodeFound,
      fullname: matchedUser.fullname,
      date: dateStr,
      status: status,
      checkIn: checkIn,
      checkOut: checkOut,
    });
  }

  return records;
}
