import pool from "./db.js";

async function checkSchema() {
  try {
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log("Tables:", tables.rows.map(t => t.table_name));

    const leaveStats = await pool.query("SELECT COUNT(*) FROM leaves").catch(e => ({error: e.message}));
    console.log("Leaves count or error:", leaveStats);

    const dprStats = await pool.query("SELECT COUNT(*) FROM dpr_entries").catch(e => ({error: e.message}));
    console.log("DPR entries count or error:", dprStats);

    const dprTasksStats = await pool.query("SELECT COUNT(*) FROM dpr_tasks").catch(e => ({error: e.message}));
    console.log("DPR tasks count or error:", dprTasksStats);

  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

checkSchema();
