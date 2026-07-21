import {Pool} from "pg";

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

//check db connection
try{
    await pool.connect();
    console.log("Connected to database successfully");
}catch(err){
    console.log("Database connection failed:", err);
    process.exit(1);
}

export default pool;