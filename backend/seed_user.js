import bcrypt from "bcryptjs";
import pool from "./db.js";

async function seed() {
  const client = await pool.connect();

  try {
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100),
        email VARCHAR(100),
        role VARCHAR(50) DEFAULT 'employee',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const username = "superadmin";
    const plainPassword = "super123";
    const name = "Super Administrator";
    const email = "admin@uavtech.com";
    const role = "super_admin";

   
    const { rows } = await client.query(
      "SELECT * FROM users WHERE role = 'super_admin'"
    );

    if (rows.length === 0) {
      const hash = await bcrypt.hash(plainPassword, 10);

      await client.query(
        "INSERT INTO users (username, password, name, email, role) VALUES ($1, $2, $3, $4, $5)",
        [username, hash, name, email, role]
      );

      console.log("Super Admin created successfully");
      console.log("Username: superadmin");
      console.log("Password: super123");
    } else {
      console.log("Super Admin already exists");
    }

  } catch (err) {
    console.error("SEED ERROR:", err);
  } finally {
    client.release();
    process.exit(0);
  }
}

seed();
