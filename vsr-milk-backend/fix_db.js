const mysql = require('mysql2');
require('dotenv').config({ path: './.env' });

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'Jagadesh',
    password: process.env.DB_PASSWORD || 'Jagadesh@Reddy14',
    database: process.env.DB_NAME || 'vsr_milk_products'
});

db.connect((err) => {
    if (err) {
        console.error('Connection error:', err);
        process.exit(1);
    }
    console.log('Connected to MySQL');

    const sql = "ALTER TABLE users MODIFY profile_image LONGTEXT";
    db.query(sql, (err, result) => {
        if (err) {
            console.error('Migration error:', err);
            db.end();
            process.exit(1);
        }
        console.log('Successfully modified profile_image to LONGTEXT');
        
        // Also check if addresses table needs same update for fields added earlier
        const sqlAddr = "ALTER TABLE addresses ADD COLUMN IF NOT EXISTS type VARCHAR(50), ADD COLUMN IF NOT EXISTS house VARCHAR(255), ADD COLUMN IF NOT EXISTS street VARCHAR(255), ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE";
        db.query(sqlAddr, (err2) => {
             if (err2) console.warn('Address table update warning (might already exist):', err2.message);
             else console.log('Address table updated');
             db.end();
        });
    });
});
