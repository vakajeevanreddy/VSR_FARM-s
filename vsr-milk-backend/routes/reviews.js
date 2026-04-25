const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../middleware/auth");

// GET ALL REVIEWS (Limit to 10 for home page)
// ... (existing public get routes)

// ADD A NEW REVIEW (Authenticated)
router.post("/add", authMiddleware(), (req, res) => {
    const { product_id, rating, comment } = req.body;
    const user_id = req.user.id; // Use ID from token for security
    
    if (!rating || !comment) {
        return res.status(400).json({ error: "User ID, rating, and comment are required." });
    }

    const sql = "INSERT INTO reviews (user_id, product_id, rating, comment) VALUES (?, ?, ?, ?)";
    db.query(sql, [user_id, product_id || null, rating, comment], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Review added successfully", reviewId: result.insertId });
    });
});

module.exports = router;
