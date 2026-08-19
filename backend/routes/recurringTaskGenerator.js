import pool from "../db.js";



const FREQUENCY_MONTHS = {
  Monthly: 1,
  Quarterly: 3,
  Yearly: 12,
};

function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

async function generate() {
  const client = await pool.connect();
  try {
    const todayStr = new Date().toISOString().split("T")[0];

    const { rows: templates } = await client.query(`
      SELECT id, title, category, assigned_to, assigned_by, reviewed_by,
             recurring_frequency, recurring_end_date, last_generated_date, due_date
      FROM tasks
      WHERE is_recurring = TRUE
        AND (recurring_end_date IS NULL OR recurring_end_date >= $1)
    `, [todayStr]);

    let created = 0;

    for (const t of templates) {
      const months = FREQUENCY_MONTHS[t.recurring_frequency];
      if (!months) {
        console.warn(`Skipping template #${t.id} — unrecognized frequency "${t.recurring_frequency}"`);
        continue;
      }

      const baseline = t.last_generated_date || t.due_date;
      if (!baseline) {
        console.warn(`Skipping template #${t.id} — no baseline date to count from`);
        continue;
      }

      const nextDue = addMonths(baseline, months);

      
      if (nextDue > todayStr) continue;

      await client.query("BEGIN");
      try {
        await client.query(
          `INSERT INTO tasks (
             title, assigned_to, assigned_by, reviewed_by,
             due_date, status, category, recurring_template_id, assignment_date
           ) VALUES ($1,$2,$3,$4,$5,'Pending',$6,$7,CURRENT_DATE)`,
          [t.title, t.assigned_to, t.assigned_by, t.reviewed_by, nextDue, t.category, t.id]
        );

        await client.query(
          `UPDATE tasks SET last_generated_date = $1 WHERE id = $2`,
          [nextDue, t.id]
        );

        await client.query("COMMIT");
        created++;
        console.log(`✓ Generated instance for template #${t.id} ("${t.title}") due ${nextDue}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`❌ Failed generating instance for template #${t.id}:`, err.message);
      }
    }

    console.log(`Done. ${created} instance(s) generated.`);
  } catch (err) {
    console.error("❌ Recurring task generation failed:", err.message);
  } finally {
    client.release();
   
  }
}


export { generate as runRecurringTaskGenerator };