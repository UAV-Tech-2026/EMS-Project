import pool from "./db.js";

const leaveData = [
  { name: 'V Siddartha', cl: 2.5, ml: 5 },
  { name: 'R Sabari Vihar', cl: 7, ml: 7 },
  { name: 'Surya', cl: 5, ml: 4 },
  { name: 'Chaitanya', cl: 6, ml: 4 },
  { name: 'Shabarishan', cl: 0, ml: 0 },
  { name: 'Harshith', cl: 4, ml: 5 },
  { name: 'Mudigonda Sindhuja', cl: 5, ml: 5 },
  { name: 'Padala sai prathyusha', cl: 4, ml: 5 },
  { name: 'Divya Sree', cl: 6, ml: 7 },
  { name: 'Sravan kumar', cl: 2, ml: 2 },
  { name: 'Chiraranjan', cl: 1, ml: 3 },
  { name: 'Amit', cl: 2.5, ml: 3 },
  { name: 'Venu gopal', cl: 1, ml: 5 }
];

async function seedLeaveBalances() {
  const client = await pool.connect();
  try {
    console.log("Starting leave balances seeding...");
    await client.query("BEGIN");

    // Ensure total_cl and total_ml can store decimals
    await client.query(`ALTER TABLE employees ALTER COLUMN total_cl TYPE NUMERIC(5,2) USING total_cl::numeric`);
    await client.query(`ALTER TABLE employees ALTER COLUMN total_ml TYPE NUMERIC(5,2) USING total_ml::numeric`);

    let updatedCount = 0;
    for (const item of leaveData) {
      const res = await client.query(`
        UPDATE employees e
        SET total_cl = $1, total_ml = $2
        FROM users u
        WHERE e.user_id = u.id AND LOWER(u.fullname) LIKE LOWER($3)
        RETURNING u.fullname, e.total_cl, e.total_ml
      `, [item.cl, item.ml, `%${item.name}%`]);

      if (res.rows.length > 0) {
        console.log(`Updated ${res.rows[0].fullname}: CL = ${res.rows[0].total_cl}, ML = ${res.rows[0].total_ml}`);
        updatedCount += res.rows.length;
      } else {
        console.warn(`No user found matching name: "${item.name}"`);
      }
    }

    await client.query("COMMIT");
    console.log(`✓ Successfully updated leave balances for ${updatedCount} employee(s).`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error seeding leave balances:", err);
  } finally {
    client.release();
    pool.end();
  }
}

seedLeaveBalances();
