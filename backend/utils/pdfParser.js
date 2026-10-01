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
export function parseAttendancePdf(buffer, usersList = [], defaultUser = null) {
  const extractedText = extractTextFromPdfBuffer(buffer);
  const records = [];
  if (!extractedText) return records;

  const lines = extractedText.split(/[\r\n]+/);
  const todayStr = new Date().toISOString().split("T")[0];

  // Document-wide Month & Year auto-detection from PDF header text
  let docYear = new Date().getFullYear().toString();
  let docMonth = (new Date().getMonth() + 1).toString().padStart(2, "0");

  const monthNames = {
    january: "01", jan: "01", february: "02", feb: "02", march: "03", mar: "03",
    april: "04", apr: "04", may: "05", june: "06", jun: "06", july: "07", jul: "07",
    august: "08", aug: "08", september: "09", sep: "09", sept: "09", october: "10", oct: "10",
    november: "11", nov: "11", december: "12", dec: "12"
  };

  // 1. Check for any full DD-MM-YYYY or DD/MM/YYYY in extracted text
  const fullDateMatch = extractedText.match(/\b(\d{1,2})[-/](0[1-9]|1[0-2])[-/](\d{4})\b/);
  if (fullDateMatch) {
    docMonth = fullDateMatch[2].padStart(2, "0");
    docYear = fullDateMatch[3];
  } else {
    // 2. Check for YYYY-MM-DD
    const isoDateMatch = extractedText.match(/\b(\d{4})[-/](0[1-9]|1[0-2])[-/](\d{1,2})\b/);
    if (isoDateMatch) {
      docYear = isoDateMatch[1];
      docMonth = isoDateMatch[2].padStart(2, "0");
    } else {
      // 3. Check for month name and year e.g. "September 2026" or "Sep 2026"
      const monthYearMatch = extractedText.match(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\b[\s\S]{0,30}\b(\d{4})\b/i);
      if (monthYearMatch) {
        const mName = monthYearMatch[1].toLowerCase();
        if (monthNames[mName]) docMonth = monthNames[mName];
        docYear = monthYearMatch[2];
      }
    }
  }

  // RegEx patterns (supports YYYY-MM-DD, DD-MM-YYYY, DD-MM, DD/MM)
  const dateRegex = /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}[-/]\d{1,2})\b/;
  const statusRegex = /\b(Casual Leave|Medical Leave|Sick Leave|Paid Leave|Loss of Pay|Half Day|Field Work|Present|Absent|CL|ML|SL|PL|LOP|HD|CCL|FW|P|A|0\.5)\b/i;

  let activeMatchedUser = defaultUser || (usersList.length > 0 ? usersList[0] : null);

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

    // If a new user was identified on this line, set them as active user
    if (matchedUser) {
      activeMatchedUser = matchedUser;
    } else {
      matchedUser = activeMatchedUser;
    }

    // Check if line contains date or status record
    const hasDate = dateRegex.test(line);
    const hasStatus = statusRegex.test(line);

    if (!hasDate && !hasStatus) continue;
    if (!matchedUser) continue;

    // Parse date from line (handles YYYY-MM-DD, DD-MM-YYYY, DD-MM, or Day numbers)
    let dateStr = `${docYear}-${docMonth}-01`;
    const dateMatch = line.match(dateRegex);
    if (dateMatch) {
      const rawDate = dateMatch[1];
      const parts = rawDate.split(/[-/]/);
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        dateStr = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
      } else if (parts.length === 3 && parts[2]?.length === 4) {
        // DD-MM-YYYY or MM-DD-YYYY
        let day = parts[0].padStart(2, "0");
        let month = parts[1].padStart(2, "0");
        if (Number(parts[1]) > 12 && Number(parts[0]) <= 12) {
          day = parts[1].padStart(2, "0");
          month = parts[0].padStart(2, "0");
        }
        dateStr = `${parts[2]}-${month}-${day}`;
      } else if (parts.length === 3 && parts[2]?.length === 2) {
        const yr = Number(parts[2]) > 50 ? "19" + parts[2] : "20" + parts[2];
        dateStr = `${yr}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      } else if (parts.length === 2) {
        // DD-MM format e.g. "01-09" or "03-09"
        const day = parts[0].padStart(2, "0");
        const month = parts[1].padStart(2, "0");
        dateStr = `${docYear}-${month}-${day}`;
      }
    } else {
      // Fallback: check if line starts with day number e.g. "01 Present" or "15 CL"
      const dayMatch = line.match(/\b([0-2]?\d|3[01])\b/);
      if (dayMatch) {
        const day = dayMatch[1].padStart(2, "0");
        dateStr = `${docYear}-${docMonth}-${day}`;
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
