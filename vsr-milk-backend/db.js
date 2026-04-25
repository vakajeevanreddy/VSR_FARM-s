const mysql = require("mysql2");

// Create MySQL connection
const db = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "Jagadesh",
    password: process.env.DB_PASSWORD || "Jagadesh@Reddy14",
    database: process.env.DB_NAME || "vsr_milk_products",
    port: process.env.DB_PORT || 3306
});

// Connect to MySQL
db.connect((err) => {

    if (err) {
        console.error("❌ Database connection failed:", err.message);
        return;
    }

    console.log("✅ MySQL Connected Successfully");

});

module.exports = db;