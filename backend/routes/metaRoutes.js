import express from "express";
import pool from "../db.js";
import { verifyToken, isHRAdminOrSuper } from "../middleware/authMiddleware.js";

const router = express.Router();

const ALL_ROLES = [
  { value: "admin",    label: "Admin" },
  { value: "employee", label: "Employee" },
  { value: "intern",   label: "Intern" },
];

const CREATABLE_ROLES = {
  super_admin: ["admin", "employee", "intern"],
  admin:       ["employee", "intern"],
};

const ALL_FEATURES = [
  "attendance", "upload_attendance", "attendance_records", "attendance_reports",
  "leaves", "directory", "enroll", "tasks", "bulletins", "dpr",
  "departments", "payslips", "meetings", "permissions"
];

const EMPLOYEE_FEATURES = ["attendance", "bulletins", "tasks", "dpr"];

const DEFAULT_DEPARTMENTS = [
  "Product Research Department (PRD)", 
  "Product Engineering Department (PED)",
  "Product Development Department - Software", 
  "Product Development Department - Integration & Test Team", 
  "Product Development Department - Flight Test & Trials", 
  "Product Development Department - Production, Test & Inspection",
  "Project Management Team (PMT)", 
  "Business Management Department (BMD)", 
  "Quality Assurance (QA)",
  "Human Resources (HR)", 
  "Operations",
];


const DEPT_MAPPING = {
  // Old PDD- prefix names → full names
  "PRD-Product Research Department": "Product Research Department (PRD)",
  "PED-Product Engineering Department": "Product Engineering Department (PED)",
  "PDD-Software": "Product Development Department - Software",
  "PDD-I&TT": "Product Development Department - Integration & Test Team",
  "PDD-FT&T": "Product Development Department - Flight Test & Trials",
  "PDD-PTI": "Product Development Department - Production, Test & Inspection",
  "PMT": "Project Management Team (PMT)",
  "BMD": "Business Management Department (BMD)",
  "QA":  "Quality Assurance (QA)",
  "HR":  "Human Resources (HR)",
  // Intermediate abbreviated names → full names (these appear as duplicates)
  "Product Development Department - FT&T":  "Product Development Department - Flight Test & Trials",
  "Product Development Department - I&TT":  "Product Development Department - Integration & Test Team",
  "Product Development Department - PTI":   "Product Development Department - Production, Test & Inspection",
  "Product Development Department - I&TT (PDD)": "Product Development Department - Integration & Test Team",
};



router.get("/roles-for-caller", verifyToken, (req, res) => {
  const callerRole = req.user.role?.toLowerCase();
  const allowed = CREATABLE_ROLES[callerRole] || [];
  res.json(ALL_ROLES.filter(r => allowed.includes(r.value)));
});


router.get("/role-defaults/:role", verifyToken, (req, res) => {
  const role = req.params.role?.toLowerCase();
  const dept = req.query.department || "";
  console.log("[MetaRoutes] role-defaults for: " + role + " dept: " + dept);
  let features = [];
  if (role === "super_admin" || role === "admin") features = [...ALL_FEATURES];
  else if (role === "employee" || role === "intern") features = [...EMPLOYEE_FEATURES];
  console.log("[MetaRoutes] returning " + features.length + " features");
  res.json(features);
});


router.get("/departments", verifyToken, async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

   
    for (const [oldName, newName] of Object.entries(DEPT_MAPPING)) {
      await pool.query(`UPDATE departments SET name = $1 WHERE name = $2`, [newName, oldName]);
      await pool.query(`UPDATE users SET department = $1 WHERE department = $2`, [newName, oldName]);
      await pool.query(`UPDATE employees SET department = $1 WHERE department = $2`, [newName, oldName]);
      // Remove old name if it still exists after rename (edge case duplicate cleanup)
      await pool.query(`DELETE FROM departments WHERE name = $1`, [oldName]);
    }

    // Deduplicate: keep only one row per name (remove any exact duplicates)
    await pool.query(`
      DELETE FROM departments WHERE id NOT IN (
        SELECT MIN(id) FROM departments GROUP BY name
      )
    `);


   
    try {
      await pool.query('ALTER TABLE employees ADD COLUMN police_certificate TEXT');
      await pool.query('ALTER TABLE employees ADD COLUMN medical_certificate TEXT');
    } catch (e) {} 

    // Always upsert so new departments (e.g. QA) are added to existing DBs
    for (const name of DEFAULT_DEPARTMENTS) {
      await pool.query(
        "INSERT INTO departments (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
        [name]
      );
    }
    const result = await pool.query("SELECT name FROM departments ORDER BY name ASC");
    return res.json(result.rows.map(r => r.name));
  } catch (err) {
    console.error("[MetaRoutes] departments error:", err.message);
    return res.json(DEFAULT_DEPARTMENTS);
  }
});

// ── Custom Field Definitions ──
router.get("/custom-fields", verifyToken, async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS custom_field_definitions (
        id SERIAL PRIMARY KEY,
        section VARCHAR(50) NOT NULL,
        label VARCHAR(100) NOT NULL,
        field_key VARCHAR(100) UNIQUE NOT NULL,
        field_type VARCHAR(50) DEFAULT 'text',
        options JSONB DEFAULT '[]'::jsonb,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    const result = await pool.query("SELECT * FROM custom_field_definitions ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("[MetaRoutes] get custom fields error:", err.message);
    res.status(500).json({ msg: "Server error fetching custom fields" });
  }
});

router.post("/custom-fields", verifyToken, isHRAdminOrSuper, async (req, res) => {
  try {
    const { section, label, field_key, field_type, options } = req.body;
    if (!section || !label) {
      return res.status(400).json({ msg: "Section and Label are required" });
    }
    const safeKey = (field_key || label)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/^_+|_+$/g, "");

    const insertRes = await pool.query(
      `INSERT INTO custom_field_definitions (section, label, field_key, field_type, options, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (field_key) DO UPDATE
         SET label = EXCLUDED.label, section = EXCLUDED.section, field_type = EXCLUDED.field_type
       RETURNING *`,
      [
        section,
        label.trim(),
        safeKey,
        field_type || "text",
        JSON.stringify(options || []),
        req.user.id
      ]
    );

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    console.error("[MetaRoutes] create custom field error:", err.message);
    res.status(500).json({ msg: "Failed to create custom field: " + err.message });
  }
});

router.delete("/custom-fields/:id", verifyToken, isHRAdminOrSuper, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM custom_field_definitions WHERE id = $1", [id]);
    res.json({ msg: "Custom field deleted successfully" });
  } catch (err) {
    console.error("[MetaRoutes] delete custom field error:", err.message);
    res.status(500).json({ msg: "Failed to delete custom field" });
  }
});

export default router;