import ExcelJS from "exceljs";
import { parseAttendanceExcel } from "../utils/excelParser.js";

async function runTest() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Attendance Report");

  // Row 1: Header
  ws.getRow(1).values = [
    "Dept. Name", "Default", "", "", "", "", "", "", "", "", "", "",
    "CompName", "", "", "UAV TECH PVT LTD", "", "", "", "", "", "", "", "", "", "",
    "Report Month", "", "", "September-2026"
  ];

  // Row 2: Employee metadata
  ws.getRow(2).values = [
    "Empcode", "0026", "Name", "Sravan", "", "", "", "", "", "", "", "",
    "Present", "3", "WO", "0", "HL", "0", "LV", "0", "Absent", "27", "Tot. Work+OT", "21:25", "Total OT", "0:00"
  ];

  // Row 3: Day numbers 1..31 in cols 3..33 (C..AF)
  const daysRow = ["", ""];
  for (let i = 1; i <= 31; i++) daysRow.push(i.toString());
  ws.getRow(3).values = daysRow;

  // Row 4: Day names
  const dayNames = ["", "", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu"];
  ws.getRow(4).values = dayNames;

  // Row 5: IN
  ws.getRow(5).values = ["IN", "", "11:30", "11:02", "--:--", "10:26", "--:--", "--:--", "--:--"];

  // Row 6: OUT
  ws.getRow(6).values = ["OUT", "", "17:45", "18:25", "--:--", "18:13", "--:--", "--:--", "--:--"];

  // Row 7: WORK
  ws.getRow(7).values = ["WORK", "", "06:15", "07:23", "00:00", "07:47", "00:00", "00:00", "00:00"];

  // Row 8: Break
  ws.getRow(8).values = ["Break", "", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00"];

  // Row 9: OT
  ws.getRow(9).values = ["OT", "", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00", "00:00"];

  // Row 10: Status
  ws.getRow(10).values = ["Status", "", "P", "P", "A", "P", "A", "A", "A"];

  const buffer = await wb.xlsx.writeBuffer();

  const mockUsers = [
    { id: 10, fullname: "Sravan Kumar", employee_uav_id: "UTPLA0026" }
  ];

  console.log("Parsing test workbook...");
  const records = await parseAttendanceExcel(buffer, mockUsers);

  console.log(`Parsed ${records.length} records!`);
  console.log("First 5 records:", records.slice(0, 5));
}

runTest().catch(console.error);
