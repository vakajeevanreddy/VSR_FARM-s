const mysql = require("mysql2");
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '..')));

// Import database configuration
const db = require('../config/database');

// Import authentication routes
const authRoutes = require('./server/auth-routes');

// Use authentication routes
app.use('/api', authRoutes);

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Use Connection Pool for robustness
const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "vsr_milk_products",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection((err, connection) => {
    if (err) {
        console.error("Error connecting to MySQL:", err);
        return;
    }
    console.log("MySQL Connected via Pool...");
    connection.release();
});

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Prevent filename collisions
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// API: Upload File
app.post("/api/upload", upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    const { filename, originalname, mimetype, size, path: filePath } = req.file;

    const sql = "INSERT INTO files (filename, original_name, path, mimetype, size) VALUES (?, ?, ?, ?, ?)";
    const values = [filename, originalname, filePath, mimetype, size];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Database Insert Error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.status(201).json({
            message: "File uploaded successfully",
            fileId: result.insertId,
            filename: filename,
            originalName: originalname
        });
    });
});

// API: Get All Files Metadata
app.get("/api/files", (req, res) => {
    db.query("SELECT * FROM files ORDER BY upload_date DESC", (err, results) => {
        if (err) {
            console.error("Database Fetch Error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

// API: Download File
app.get("/api/files/download/:id", (req, res) => {
    const fileId = req.params.id;
    db.query("SELECT * FROM files WHERE id = ?", [fileId], (err, results) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).send("Server Error");
        }
        if (results.length === 0) {
            return res.status(404).send("File not found");
        }

        const file = results[0];
        res.download(file.path, file.original_name);
    });
});

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});



