const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../middleware/auth");

// Helper to check ownership
const checkOwnership = (req, res, targetUserId) => {
    if (req.user.role !== 'owner' && req.user.id != targetUserId) {
        res.status(403).json({ error: "Access denied: You can only access your own orders." });
        return false;
    }
    return true;
};

// CREATE ORDER with Security Checks
router.post("/create", authMiddleware(), async (req, res) => {
    const { address_id, total_amount, items, payment_method, transaction_id } = req.body;
    const user_id = req.user.id; // Use ID from token for security

    if (!user_id || !items || items.length === 0) {
        return res.status(400).json({ error: "User ID and items are required." });
    }

    const connection = db.promise();
    try {
        // 1. DUPLICATE PAYMENT PREVENTION
        if (transaction_id && payment_method !== 'cod') {
            const checkSql = "SELECT id FROM payments WHERE transaction_id = ?";
            const [existingPayment] = await connection.query(checkSql, [transaction_id]);
            if (existingPayment.length > 0) {
                return res.status(409).json({ error: "Duplicate payment detected. This transaction has already been processed." });
            }
        }

        // 2. PRICE TAMPERING PROTECTION (Backend Validation)
        const productIds = items.map(item => item.id || item.product_id);
        const [products] = await connection.query("SELECT id, price FROM products WHERE id IN (?)", [productIds]);
        
        let calculatedTotal = 0;
        items.forEach(item => {
            const product = products.find(p => p.id === (item.id || item.product_id));
            if (product) {
                calculatedTotal += product.price * item.quantity;
            }
        });

        // Tolerance for small rounding differences
        if (Math.abs(calculatedTotal - total_amount) > 0.01) {
            return res.status(400).json({ error: "Total amount mismatch. Price tampering detected." });
        }

        // 3. PAYMENT VERIFICATION (Placeholder for Gateway API)
        if (payment_method !== 'cod' && !transaction_id) {
            return res.status(400).json({ error: "Transaction ID is required for online payments." });
        }

        // Start Transaction
        await connection.beginTransaction();

        const orderSql = "INSERT INTO orders (user_id, address_id, total_amount, status) VALUES (?, ?, ?, 'pending')";
        const [orderResult] = await connection.query(orderSql, [user_id, address_id || null, calculatedTotal]);
        const orderId = orderResult.insertId;

        // Insert Order Items
        const itemSql = "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ?";
        const itemValues = items.map(item => {
            const product = products.find(p => p.id === (item.id || item.product_id));
            return [orderId, product.id, item.quantity, product.price];
        });
        await connection.query(itemSql, [itemValues]);

        // Insert Payment record
        const paymentSql = "INSERT INTO payments (order_id, payment_method, payment_status, transaction_id, paid_at) VALUES (?, ?, ?, ?, ?)";
        const payStatus = payment_method === 'cod' ? 'pending' : 'completed';
        const paidAt = payment_method === 'cod' ? null : new Date();
        await connection.query(paymentSql, [orderId, payment_method, payStatus, transaction_id || null, paidAt]);

        await connection.commit();
        res.json({ message: "Order placed successfully", orderId: orderId });

    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error("Order creation error:", error);
        res.status(500).json({ error: "Failed to create order. Please try again." });
    }
});

// GET USER ORDERS
router.get("/user/:userId", authMiddleware(), (req, res) => {
    const userId = req.params.userId;
    if (!checkOwnership(req, res, userId)) return;
    const sql = `
        SELECT o.id, o.total_amount, o.status, o.order_date, p.payment_method, p.payment_status
        FROM orders o
        LEFT JOIN payments p ON o.id = p.order_id
        WHERE o.user_id = ?
        ORDER BY o.order_date DESC
    `;

    db.query(sql, [userId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result);
    });
});

// GET ORDER DETAILS (Items)
router.get("/details/:orderId", (req, res) => {
    const orderId = req.params.orderId;
    const sql = `
        SELECT oi.id, p.name, p.image_url, oi.quantity, oi.price
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
    `;

    db.query(sql, [orderId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result);
    });
});

module.exports = router;