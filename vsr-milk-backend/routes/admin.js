const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../middleware/auth");

// Apply authentication and role check to all admin routes
router.use(authMiddleware(['owner']));

// GET ADMIN STATS
router.get("/stats", (req, res) => {
    // We'll perform multiple queries to get the stats
    // 1. Total Customers
    // 2. Total Orders
    // 3. Total Sales
    // 4. Recent Orders (limit 5)
    // 5. Product Views (placeholder or from a dedicated table if exists)

    const statsQueries = {
        totalCustomers: "SELECT COUNT(*) as count FROM users",
        totalOrders: "SELECT COUNT(*) as count FROM orders",
        totalSales: "SELECT SUM(total_amount) as total FROM orders",
        recentOrders: `
            SELECT o.id, u.name as customerName, o.total_amount as totalAmount, 'Success' as status, o.order_date as createdAt
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            ORDER BY o.order_date DESC
            LIMIT 5
        `,
        productViews: "SELECT name as _id, 0 as count FROM products LIMIT 5" // Placeholder as there is no views table yet
    };

    const results = {};

    db.query(statsQueries.totalCustomers, (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        results.totalCustomers = users[0].count;

        db.query(statsQueries.totalOrders, (err, orders) => {
            if (err) return res.status(500).json({ error: err.message });
            results.totalOrders = orders[0].count;

            db.query(statsQueries.totalSales, (err, sales) => {
                if (err) return res.status(500).json({ error: err.message });
                results.totalSales = sales[0].total || 0;

                db.query(statsQueries.recentOrders, (err, recent) => {
                    if (err) return res.status(500).json({ error: err.message });
                    results.recentOrders = recent;

                    db.query(statsQueries.productViews, (err, views) => {
                        if (err) return res.status(500).json({ error: err.message });
                        results.productViews = views;
                        res.json(results);
                    });
                });
            });
        });
    });
});

// GET ALL ORDERS FOR MANAGEMENT
router.get("/orders", (req, res) => {
    const sql = `
        SELECT o.id, u.name as customerName, o.total_amount, o.status, o.order_date, p.payment_method, p.payment_status
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN payments p ON o.id = p.order_id
        ORDER BY o.order_date DESC
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// UPDATE ORDER STATUS
router.put("/order/:id/status", (req, res) => {
    const orderId = req.params.id;
    const { status } = req.body;
    
    if (!status) return res.status(400).json({ error: "Status is required" });

    const sql = "UPDATE orders SET status = ? WHERE id = ?";
    db.query(sql, [status, orderId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Order status updated successfully" });
    });
});

module.exports = router;
