const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const db = require("../db");
const authMiddleware = require("../middleware/auth");

// Helper to check ownership
const checkOwnership = (req, res, targetUserId) => {
    if (req.user.role !== 'owner' && req.user.id != targetUserId) {
        res.status(403).json({ error: "Access denied: You can only access your own data." });
        return false;
    }
    return true;
};

// REGISTER
router.post("/register", (req, res) => {
    const { name, email, password, phone_number } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email, and password are required." });
    }

    const sql = "INSERT INTO users (name, email, password, phone_number) VALUES (?, ?, ?, ?)";

    db.query(sql, [name, email, password, phone_number || null], (err, result) => {
        if (err) {
            // Duplicate email check
            if (err.code === "ER_DUP_ENTRY") {
                return res.status(409).json({ error: "Email already registered." });
            }
            console.error("Register error:", err.message);
            return res.status(500).json({ error: "Registration failed. Please try again." });
        }
        res.json({ message: "User registered successfully", userId: result.insertId });
    });
});

// LOGIN (email OR phone number) - Unified for both Customer and Owner
router.post("/login", (req, res) => {
    const { email, phone_number, password } = req.body;

    if (!password) {
        return res.status(400).json({ error: "Password is required." });
    }

    let sql, params;

    if (email) {
        sql = "SELECT * FROM users WHERE email = ? AND password = ?";
        params = [email, password];
    } else if (phone_number) {
        sql = "SELECT * FROM users WHERE phone_number = ? AND password = ?";
        params = [phone_number, password];
    } else {
        return res.status(400).json({ error: "Email or phone number is required." });
    }

    db.query(sql, params, (err, result) => {
        if (err) {
            console.error("Login error:", err.message);
            return res.status(500).json({ error: "Login failed. Please try again." });
        }

        if (result && result.length > 0) {
            const user = { ...result[0] };
            delete user.password; // Never send password back

            // Create JWT Token
            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role },
                process.env.JWT_SECRET || 'VSR_SECRET_KEY_2024',
                { expiresIn: '24h' }
            );

            res.json({
                message: "Login successful",
                token,
                user
            });
        } else {
            res.status(401).json({ error: "Invalid credentials." });
        }
    });
});

// DEMO PASSWORD RESET
router.post("/reset-password-demo", (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
        return res.status(400).json({ error: "Email and new password are required." });
    }

    db.query("UPDATE users SET password = ? WHERE email = ?", [newPassword, email], (err, result) => {
        if (err) {
            console.error("Reset password error:", err.message);
            return res.status(500).json({ error: "Failed to reset password." });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Email not found in our records." });
        }
        res.json({ message: "Password has been successfully updated!" });
    });
});

// --- THE FOLLOWING ROUTES ARE PROTECTED ---

// SYNC FIREBASE USER WITH MYSQL
router.post("/sync", (req, res) => {
    const { name, email, phone_number } = req.body;

    if (!email) {
        return res.status(400).json({ error: "Email is required for synchronization." });
    }

    // Check if user exists by email
    const checkSql = "SELECT id, name, email FROM users WHERE email = ?";
    db.query(checkSql, [email], (err, result) => {
        if (err) {
            console.error("Sync check error:", err.message);
            return res.status(500).json({ error: "Synchronization failed." });
        }

        if (result && result.length > 0) {
            const user = result[0];
            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role || 'customer' },
                process.env.JWT_SECRET || 'VSR_SECRET_KEY_2024',
                { expiresIn: '24h' }
            );
            res.json({ message: "User synced", user, token });
        } else {
            const insertSql = "INSERT INTO users (name, email, password, phone_number) VALUES (?, ?, ?, ?)";
            const dummyPassword = "FIREBASE_AUTH_USER";
            db.query(insertSql, [name || 'Customer', email, dummyPassword, phone_number || null], (err, insertResult) => {
                if (err) {
                    console.error("Sync insert error:", err.message);
                    return res.status(500).json({ error: "Failed to create user record." });
                }
                const newUser = { id: insertResult.insertId, name: name || 'Customer', email, role: 'customer' };
                const token = jwt.sign(
                    { id: newUser.id, email: newUser.email, role: newUser.role },
                    process.env.JWT_SECRET || 'VSR_SECRET_KEY_2024',
                    { expiresIn: '24h' }
                );
                res.json({ message: "User created and synced", user: newUser, token });
            });
        }
    });
});

// GET USER BY ID
router.get("/:id", authMiddleware(), (req, res) => {
    const { id } = req.params;
    if (!checkOwnership(req, res, id)) return;

    db.query("SELECT id, name, email, phone_number, gender, profile_image, role FROM users WHERE id = ?", [id], (err, result) => {
        if (err) {
            console.error("Get user error:", err.message);
            return res.status(500).json({ error: "Failed to fetch user data." });
        }
        if (result.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }
        res.json(result[0]);
    });
});

// UPDATE USER PROFILE
router.put("/:id", authMiddleware(), (req, res) => {
    const { id } = req.params;
    const { name, phone_number, gender, profile_image } = req.body;

    if (!checkOwnership(req, res, id)) return;

    const sql = "UPDATE users SET name = ?, phone_number = ?, gender = ?, profile_image = ? WHERE id = ?";
    db.query(sql, [name, phone_number, gender, profile_image, id], (err, result) => {
        if (err) {
            console.error("Update user error:", err.message);
            return res.status(500).json({ error: "Failed to update profile." });
        }
        res.json({ message: "Profile updated successfully!" });
    });
});

module.exports = router;