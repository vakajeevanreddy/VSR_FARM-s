const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../middleware/auth");

// Apply authentication to all cart routes
router.use(authMiddleware());

// Helper to check ownership
const checkOwnership = (req, res, targetUserId) => {
    if (req.user.role !== 'owner' && req.user.id != targetUserId) {
        res.status(403).json({ error: "Access denied: You can only access your own cart." });
        return false;
    }
    return true;
};

// ADD TO CART (or update quantity if product already in cart)
router.post("/add", (req, res) => {
    const { user_id, product_id, quantity } = req.body;
    if (!checkOwnership(req, res, user_id)) return;

    if (!user_id || !product_id) {
        return res.status(400).json({ error: "user_id and product_id are required." });
    }

    const qty = parseInt(quantity) || 1;

    const checkQuery = "SELECT * FROM cart WHERE user_id = ? AND product_id = ?";

    db.query(checkQuery, [user_id, product_id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        if (result && result.length > 0) {
            // Update existing cart item
            const updateQuery = "UPDATE cart SET quantity = quantity + ? WHERE user_id = ? AND product_id = ?";
            db.query(updateQuery, [qty, user_id, product_id], (err2) => {
                if (err2) return res.status(500).json({ error: err2.message });
                res.json({ message: "Cart updated" });
            });
        } else {
            // Insert new cart item
            const insertQuery = "INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)";
            db.query(insertQuery, [user_id, product_id, qty], (err2) => {
                if (err2) return res.status(500).json({ error: err2.message });
                res.json({ message: "Product added to cart" });
            });
        }
    });
});

// GET USER CART (with product details via JOIN)
router.get("/:userId", (req, res) => {
    const userId = req.params.userId;

    const query = `
        SELECT cart.id, products.name, products.price,
               products.image_url, cart.quantity
        FROM cart
        JOIN products ON cart.product_id = products.id
        WHERE cart.user_id = ?
    `;

    db.query(query, [userId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result || []);
    });
});

// UPDATE QUANTITY
router.put("/update", (req, res) => {
    const { cart_id, quantity } = req.body;

    if (!cart_id || quantity === undefined) {
        return res.status(400).json({ error: "cart_id and quantity are required." });
    }

    if (parseInt(quantity) <= 0) {
        // Remove item if quantity is 0 or negative
        db.query("DELETE FROM cart WHERE id = ?", [cart_id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Item removed from cart" });
        });
        return;
    }

    const query = "UPDATE cart SET quantity = ? WHERE id = ?";
    db.query(query, [quantity, cart_id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Quantity updated" });
    });
});

// REMOVE ITEM BY USER_ID AND PRODUCT_ID
router.delete("/remove-item", (req, res) => {
    const { user_id, product_id } = req.body;
    if (!user_id || !product_id) {
        return res.status(400).json({ error: "user_id and product_id are required." });
    }

    db.query("DELETE FROM cart WHERE user_id = ? AND product_id = ?", [user_id, product_id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Item removed" });
    });
});

// UPDATE QTY BY USER_ID AND PRODUCT_ID
router.put("/update-qty", (req, res) => {
    const { user_id, product_id, quantity } = req.body;
    if (!user_id || !product_id || quantity === undefined) {
        return res.status(400).json({ error: "user_id, product_id and quantity are required." });
    }

    db.query("UPDATE cart SET quantity = ? WHERE user_id = ? AND product_id = ?", [quantity, user_id, product_id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Quantity updated" });
    });
});

// REMOVE ITEM BY CART_ID
router.delete("/remove/:id", (req, res) => {
    const { id } = req.params;

    db.query("DELETE FROM cart WHERE id = ?", [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Item removed" });
    });
});

// CLEAR CART (after order placed)
router.delete("/clear/:userId", (req, res) => {
    const { userId } = req.params;

    db.query("DELETE FROM cart WHERE user_id = ?", [userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Cart cleared" });
    });
});

module.exports = router;