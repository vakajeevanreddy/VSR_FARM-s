const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vsr_milk_products',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test connection
pool.getConnection()
    .then(connection => {
        console.log('✅ MySQL Database Connected Successfully');
        connection.release();
    })
    .catch(err => {
        console.error('❌ MySQL Database Connection Failed:', err.message);
        process.exit(1);
    });

module.exports = pool;</content>
<parameter name="filePath">c:\Users\lenovo\OneDrive\Desktop\vsr_farms\vsr-milk-products\config\database.js


