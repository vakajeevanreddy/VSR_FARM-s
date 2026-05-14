const mysql = require("mysql2");

// Create MySQL connection pool
const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "Jagadesh",
    password: process.env.DB_PASSWORD || "Jagadesh@Reddy14",
    database: process.env.DB_NAME || "vsr_milk_products",
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 50,
    queueLimit: 0
});

// Test connection
db.getConnection((err, connection) => {
    if (err) {
        console.error("❌ Database connection failed:", err.message);
        return;
    }
    console.log("✅ MySQL Connected Successfully via Pool");
    connection.release();
});

module.exports = db;