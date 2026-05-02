const express = require("express");
const cors = require("cors");
require('dotenv').config();

const app = express();

// CORS — allow all origins for local development
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const productRoutes = require("./routes/product");
const userRoutes = require("./routes/users");
const orderRoutes = require("./routes/orders");
const cartRoutes = require("./routes/cart");
const wishlistRoutes = require("./routes/wishlist");
const adminRoutes = require("./routes/admin");
const reviewRoutes = require("./routes/reviews");

app.use("/products", productRoutes);
app.use("/users", userRoutes);
app.use("/orders", orderRoutes);
app.use("/cart", cartRoutes);
app.use("/wishlist", wishlistRoutes);
app.use("/admin", adminRoutes);
app.use("/reviews", reviewRoutes);

const path = require("path");

// Serve frontend static files
const frontendPath = path.join(__dirname, "../vsr-milk-products/public");
app.use(express.static(frontendPath));

app.use((req, res, next) => {
    if (req.method !== 'GET') {
        return next();
    }
    // For API routes not handled above, return 404 JSON, not index.html
    if (req.originalUrl.startsWith("/products") || 
        req.originalUrl.startsWith("/users") || 
        req.originalUrl.startsWith("/orders") || 
        req.originalUrl.startsWith("/cart") || 
        req.originalUrl.startsWith("/wishlist") || 
        req.originalUrl.startsWith("/admin") || 
        req.originalUrl.startsWith("/reviews")) {
        return res.status(404).json({ error: "API endpoint not found" });
    }
    // Fallback all other routes to index.html (useful for SPA behavior if needed)
    res.sendFile(path.join(frontendPath, "index.html"));
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Server Error:", err.message);
    res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});

// Export for Vercel serverless
module.exports = app;