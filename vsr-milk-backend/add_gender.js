const mysql = require('mysql2');
require('dotenv').config({ path: './.env' });

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'Jagadesh',
    password: process.env.DB_PASSWORD || 'Jagadesh@Reddy14',
    database: process.env.DB_NAME || 'vsr_milk_products',
    port: process.env.DB_PORT || 3306,
    ssl: { rejectUnauthorized: false }
});

db.connect((err) => {
    if (err) {
        console.error('Connection error:', err);
        process.exit(1);
    }
    console.log('Connected to MySQL');

    const sql = "ALTER TABLE users ADD COLUMN gender VARCHAR(50);";
    db.query(sql, (err, result) => {
        if (err && err.code !== 'ER_DUP_FIELDNAME') {
            console.error('Migration error:', err.message);
        } else {
            console.log('Successfully modified gender');
        }
        
        const sql2 = "ALTER TABLE users ADD COLUMN profile_image LONGTEXT;";
        db.query(sql2, (err2) => {
             if (err2 && err2.code !== 'ER_DUP_FIELDNAME') {
                 console.error('Migration error profile_image:', err2.message);
             } else {
                 console.log('Successfully modified profile_image');
             }
             db.end();
        });
    });
});
