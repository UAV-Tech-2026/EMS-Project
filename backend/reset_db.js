import pool from "./db.js";
import bcrypt from "bcryptjs";

async function resetDatabase() {
  const client = await pool.connect();
  try {
    console.log(" Starting Database Reset...");
    await client.query("BEGIN");

    
    console.log(" Clearing all tables...");
    await client.query(`
      TRUNCATE TABLE 
        bulletins, 
        user_permissions, 
        payslip_requests, 
        dpr_tasks, 
        dpr_entries, 
        tasks, 
        attendance, 
        leaves, 
        employees, 
        shared_documents,
        general_requests,
        notifications,
        payroll_history,
        meetings,
        users 
      RESTART IDENTITY CASCADE
    `);

    
    const superHash = await bcrypt.hash("good123", 10);
    const hrHash    = await bcrypt.hash("hr123", 10);
    const empHash   = await bcrypt.hash("emp123", 10);

   
    console.log(" Creating Super Admin...");
    const superRes = await client.query(`
      INSERT INTO users (username, password, fullname, name, email, role, phone)
      VALUES ('superadmin', $1, 'Super Administrator', 'Super Administrator', 'superadmin@uavtech.ai', 'super_admin', '6526342535')
      RETURNING id
    `, [superHash]);
    const superId = superRes.rows[0].id;

    await client.query(`
      INSERT INTO employees (user_id, employee_uav_id, fullname, designation, department, phone)
      VALUES ($1, 'UAVTechS001', 'Super Administrator', 'Director', 'Management', '6281915237')
    `, [superId]);

    await client.query("COMMIT");
    console.log("\n✅ Database Reset and Initial Setup Complete!");
   

  } catch (err) {
    if (client) await client.query("ROLLBACK");
    console.error("❌ Reset Failed:", err.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

resetDatabase();
