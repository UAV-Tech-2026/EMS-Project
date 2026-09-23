import ExcelJS from "exceljs";

export function calcHours(checkIn, checkOut) {
  if (!checkIn || !checkOut || checkIn === "--:--" || checkOut === "--:--") return "";
  try {
    const [inH, inM] = checkIn.split(":").map(Number);
    const [outH, outM] = checkOut.split(":").map(Number);
    if (isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM)) return "";
    const totalMins = (outH * 60 + outM) - (inH * 60 + inM);
    if (totalMins <= 0) return "";
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${h}h ${m}m`;
  } catch {
    return "";
  }
}

/**
 * Safely extracts string from ExcelJS cell value
 */
function getCellString(cell) {
  if (!cell || cell.value === null || cell.value === undefined) return "";
  if (typeof cell.value === "object") {
    if (cell.value instanceof Date) return cell.value.toISOString().split("T")[0];
    if (cell.value.result !== undefined && cell.value.result !== null) return String(cell.value.result).trim();
    if (cell.value.text !== undefined && cell.value.text !== null) return String(cell.value.text).trim();
    if (cell.value.richText && Array.isArray(cell.value.richText)) {
      return cell.value.richText.map(t => t.text).join("").trim();
    }
  }
  return String(cell.value).trim();
}

function parseMonthYear(str) {
  if (!str) return null;
  const s = String(str).trim();

  const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
  ];
  const shortMonths = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec"
  ];

  const monthMatch = s.match(/([a-zA-Z]+)[-/\s]+(\d{4})/);
  if (monthMatch) {
    const mStr = monthMatch[1].toLowerCase();
    const year = parseInt(monthMatch[2], 10);
    let mIdx = months.indexOf(mStr);
    if (mIdx === -1) mIdx = shortMonths.indexOf(mStr.slice(0, 3));
    if (mIdx !== -1) {
      return { year, month: mIdx + 1 };
    }
  }

  const numMatch = s.match(/(\d{2,4})[-/\s]+(\d{1,2})/);
  if (numMatch) {
    let p1 = parseInt(numMatch[1], 10);
    let p2 = parseInt(numMatch[2], 10);
    if (p1 > 1000) return { year: p1, month: p2 };
    if (p2 > 1000) return { year: p2, month: p1 };
  }

  return null;
}

function matchUser(empCode, empName, usersList) {
  if (!usersList || !usersList.length) return null;

  const cleanCode = empCode ? String(empCode).trim().toUpperCase() : "";
  const numCode = cleanCode.replace(/\D/g, "");
  const cleanName = empName ? String(empName).trim().toLowerCase() : "";

  for (const u of usersList) {
    const uCode = u.employee_uav_id ? String(u.employee_uav_id).trim().toUpperCase() : "";
    const uNumCode = uCode.replace(/\D/g, "");
    const uName = u.fullname ? String(u.fullname).trim().toLowerCase() : "";

    // 1. Exact employee code match
    if (cleanCode && uCode && cleanCode === uCode) return u;

    // 2. Numeric code match
    if (numCode && uNumCode && (numCode === uNumCode || uNumCode.endsWith(numCode) || numCode.endsWith(uNumCode))) {
      return u;
    }

    // 3. Exact fullname match
    if (cleanName && uName && cleanName === uName) return u;
  }

  // 4. Soft fullname match
  if (cleanName) {
    for (const u of usersList) {
      const uName = u.fullname ? String(u.fullname).trim().toLowerCase() : "";
      if (uName && (uName.includes(cleanName) || cleanName.includes(uName))) return u;
    }
  }

  // 5. If only 1 user exists in system and cleanCode is non-empty, auto-match to that user
  if (usersList.length === 1 && (cleanCode || cleanName)) {
    return usersList[0];
  }

  return null;
}

function normalizeStatus(rawStatus, hasCheckIn) {
  if (!rawStatus) {
    return hasCheckIn ? "Present" : "Absent";
  }
  const s = String(rawStatus).trim().toUpperCase();

  if (s === "P" || s === "PRESENT" || s === "PRESENT/PRESENT") return "Present";
  if (s === "A" || s === "ABSENT") return "Absent";
  if (s === "CL" || s === "CASUAL LEAVE") return "CL";
  if (s === "ML" || s === "SL" || s === "MEDICAL LEAVE" || s === "SICK LEAVE") return "ML";
  if (s === "PL" || s === "EL" || s === "PAID LEAVE") return "PL";
  if (s === "LOP" || s === "LOSS OF PAY") return "LOP";
  if (s === "WO" || s === "OFF" || s === "W/O" || s === "WEEKLY OFF") return "Weekly Off";
  if (s === "HL" || s === "HOL" || s === "HOLIDAY") return "Holiday";
  if (s === "LV" || s === "L" || s === "LEAVE") return "Leave";
  if (s === "HD" || s === "HALF" || s === "HALF DAY") return "Half Day";

  return s;
}

/**
 * Parse Excel Buffer - supports ALL Worksheets in Workbook (Biometric Matrix + Standard Tabular)
 */
export async function parseAttendanceExcel(buffer, usersList = []) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  if (!workbook.worksheets || !workbook.worksheets.length) {
    throw new Error("Excel worksheet is empty.");
  }

  const unmatchedSheetCodes = new Set();
  const records = [];

  for (const worksheet of workbook.worksheets) {
    if (!worksheet || !worksheet.rowCount) continue;

    let isBiometricMatrix = false;
    let globalMonthYear = null;

    // Scan first 15 rows to detect matrix format and month/year
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > 15) return;
      row.eachCell((cell) => {
        const val = getCellString(cell);
        if (/empcode/i.test(val) || /dept\.\s*name/i.test(val)) {
          isBiometricMatrix = true;
        }
        if (!globalMonthYear && /report\s*month/i.test(val)) {
          const my = parseMonthYear(val);
          if (my) globalMonthYear = my;
        }
      });
    });

    if (isBiometricMatrix) {
      const now = new Date();
      const defaultYear = globalMonthYear ? globalMonthYear.year : now.getFullYear();
      const defaultMonth = globalMonthYear ? globalMonthYear.month : now.getMonth() + 1;
      let totalRows = worksheet.rowCount;

      for (let r = 1; r <= totalRows; r++) {
        const row = worksheet.getRow(r);
        let empCodeCellIdx = -1;

        row.eachCell((cell, colNum) => {
          const txt = getCellString(cell);
          if (/empcode/i.test(txt) || /emp\s*code/i.test(txt)) {
            empCodeCellIdx = colNum;
          }
        });

        if (empCodeCellIdx === -1) continue;

        let empCode = getCellString(row.getCell(empCodeCellIdx + 1));
        if (!empCode) {
          const txt = getCellString(row.getCell(empCodeCellIdx));
          const match = txt.match(/empcode[:\s]*([a-zA-Z0-9_-]+)/i);
          if (match) empCode = match[1];
        }

        let empName = "";
        row.eachCell((cell, colNum) => {
          const txt = getCellString(cell);
          if (/name/i.test(txt) && !/dept|comp/i.test(txt)) {
            empName = getCellString(row.getCell(colNum + 1));
          }
        });

        let blockMonthYear = globalMonthYear;
        [r - 1, r].forEach((rowNum) => {
          if (rowNum < 1) return;
          const targetRow = worksheet.getRow(rowNum);
          targetRow.eachCell((c) => {
            const s = getCellString(c);
            const parsed = parseMonthYear(s);
            if (parsed) blockMonthYear = parsed;
          });
        });

        const year = blockMonthYear ? blockMonthYear.year : defaultYear;
        const month = blockMonthYear ? blockMonthYear.month : defaultMonth;

        let daysRow = null;
        let dayStartCol = -1;
        let inRow = null;
        let outRow = null;
        let workRow = null;
        let otRow = null;
        let statusRow = null;

        for (let subR = r + 1; subR <= Math.min(r + 12, totalRows); subR++) {
          const subRow = worksheet.getRow(subR);
          const firstColTxt = getCellString(subRow.getCell(1)).toUpperCase() ||
                              getCellString(subRow.getCell(2)).toUpperCase();

          if (!daysRow) {
            subRow.eachCell((cell, colNum) => {
              const val = getCellString(cell);
              if (val === "1" || val === "01") {
                const nextVal = getCellString(subRow.getCell(colNum + 1));
                if (nextVal === "2" || nextVal === "02") {
                  daysRow = subRow;
                  dayStartCol = colNum;
                }
              }
            });
          }

          if (/^IN$/i.test(firstColTxt) || /^IN\s*TIME/i.test(firstColTxt)) inRow = subRow;
          if (/^OUT$/i.test(firstColTxt) || /^OUT\s*TIME/i.test(firstColTxt)) outRow = subRow;
          if (/^WORK$/i.test(firstColTxt) || /^WORK\s*HOUR/i.test(firstColTxt)) workRow = subRow;
          if (/^OT$/i.test(firstColTxt) || /^OVERTIME/i.test(firstColTxt)) otRow = subRow;
          if (/^STATUS$/i.test(firstColTxt)) statusRow = subRow;
        }

        if (!dayStartCol || dayStartCol === -1) continue;

        const user = matchUser(empCode, empName, usersList);
        if (!user) {
          if (empCode || empName) unmatchedSheetCodes.add(empCode || empName);
          continue;
        }

        for (let day = 1; day <= 31; day++) {
          const colIdx = dayStartCol + day - 1;
          const dateObj = new Date(year, month - 1, day);
          if (dateObj.getMonth() !== month - 1) continue;

          const formattedDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

          let checkIn = inRow ? getCellString(inRow.getCell(colIdx)) : "";
          let checkOut = outRow ? getCellString(outRow.getCell(colIdx)) : "";
          let workTime = workRow ? getCellString(workRow.getCell(colIdx)) : "";
          let rawStatus = statusRow ? getCellString(statusRow.getCell(colIdx)) : "";

          if (checkIn === "--:--" || checkIn === "00:00") checkIn = "";
          if (checkOut === "--:--" || checkOut === "00:00") checkOut = "";
          if (workTime === "--:--" || workTime === "00:00") workTime = "";

          const finalStatus = normalizeStatus(rawStatus, Boolean(checkIn));
          let hoursWorked = workTime;
          if (!hoursWorked && checkIn && checkOut) {
            hoursWorked = calcHours(checkIn, checkOut);
          }

          records.push({
            userId: user.id,
            empId: user.employee_uav_id,
            fullname: user.fullname,
            date: formattedDate,
            status: finalStatus,
            checkIn: checkIn || null,
            checkOut: checkOut || null,
            hoursWorked: hoursWorked || null,
          });
        }
      }
    } else {
      // --- DYNAMIC STANDARD TABULAR FORMAT PARSER ---
      let headerRowIdx = -1;
      let colMap = { empId: 1, name: 2, date: 3, status: 4, checkIn: 5, checkOut: 6 };

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (headerRowIdx !== -1 || rowNumber > 10) return;
        let foundEmp = false, foundDate = false;

        row.eachCell((cell, colNum) => {
          const txt = getCellString(cell).toLowerCase();
          if (/emp|id|code/i.test(txt)) {
            colMap.empId = colNum;
            foundEmp = true;
          } else if (/name/i.test(txt)) {
            colMap.name = colNum;
          } else if (/date/i.test(txt)) {
            colMap.date = colNum;
            foundDate = true;
          } else if (/status/i.test(txt)) {
            colMap.status = colNum;
          } else if (/in/i.test(txt) && !/out/i.test(txt)) {
            colMap.checkIn = colNum;
          } else if (/out/i.test(txt)) {
            colMap.checkOut = colNum;
          }
        });

        if (foundEmp || foundDate) {
          headerRowIdx = rowNumber;
        }
      });

      const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 2;

      for (let r = startRow; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        const empId = getCellString(row.getCell(colMap.empId));
        const name = getCellString(row.getCell(colMap.name));
        let dateVal = row.getCell(colMap.date).value;
        const statusRaw = getCellString(row.getCell(colMap.status));
        let checkIn = getCellString(row.getCell(colMap.checkIn)) || null;
        let checkOut = getCellString(row.getCell(colMap.checkOut)) || null;

        if (!statusRaw && !dateVal && !empId) continue;

        let formattedDate;
        if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
          formattedDate = dateVal.toISOString().split("T")[0];
        } else {
          const dateStr = getCellString(row.getCell(colMap.date));
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) {
            formattedDate = parsed.toISOString().split("T")[0];
          } else {
            continue;
          }
        }

        const user = matchUser(empId, name, usersList);
        if (!user) {
          if (empId || name) unmatchedSheetCodes.add(empId || name);
          continue;
        }

        const status = normalizeStatus(statusRaw, Boolean(checkIn));
        const hoursWorked = calcHours(checkIn, checkOut);

        records.push({
          userId: user.id,
          empId: user.employee_uav_id,
          fullname: user.fullname,
          date: formattedDate,
          status,
          checkIn: checkIn || null,
          checkOut: checkOut || null,
          hoursWorked: hoursWorked || null,
        });
      }
    }
  }

  records.unmatchedSheetCodes = Array.from(unmatchedSheetCodes);
  return records;
}
