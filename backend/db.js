import pkg from "pg";
import dotenv from "dotenv"; 

dotenv.config(); 
const { Pool } = pkg;

const pool = new Pool({
  
  connectionString: process.env.DATABASE_URL 
});
pool.query("SELECT current_database()", (err, res) => {
  console.log("Connected DB:", res?.rows);
});


export default pool;