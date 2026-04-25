const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../middleware/auth");

// Apply authentication to all wishlist routes
router.use(authMiddleware());

// Helper to check ownership
const checkOwnership = (req, res, targetUserId) => {
    if (req.user.role !== 'owner' && req.user.id != targetUserId) {
        res.status(403).json({ error: "Access denied: You can only access your own wishlist." });
        return false;
    }
    return true;
};

// ADD TO WISHLIST
router.post("/add", (req, res) => {
    const { user_id, product_id } = req.body;
    if (!checkOwnership(req, res, user_id)) return;

    if (!user_id || !product_id) {
        return res.status(400).json({ error: "user_id and product_id are required." });
    }

    // Check if already in wishlist
    db.query("SELECT * FROM wishlist WHERE user_id = ? AND product_id = ?", [user_id, product_id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        if (result && result.length > 0) {
            return res.json({ message: "Product already in wishlist" });
        }

        db.query("INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)", [user_id, product_id], (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ message: "Product added to wishlist" });
        });
    });
});

// GET USER WISHLIST
router.get("/:userId", (req, res) => {
    const userId = req.params.userId;

    const query = `
        SELECT wishlist.id, products.id as product_id, products.name, products.price, products.image_url
        FROM wishlist
        JOIN products ON wishlist.product_id = products.id
        WHERE wishlist.user_id = ?
    `;

    db.query(query, [userId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result || []);
    });
});

// REMOVE FROM WISHLIST
router.delete("/remove", (req, res) => {
    const { user_id, product_id } = req.body;

    if (!user_id || !product_id) {
        return res.status(400).json({ error: "user_id and product_id are required." });
    }

    db.query("DELETE FROM wishlist WHERE user_id = ? AND product_id = ?", [user_id, product_id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Removed from wishlist" });
    });
});

module.exports = router;
