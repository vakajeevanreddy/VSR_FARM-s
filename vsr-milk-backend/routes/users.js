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
router.post("/sync", authMiddleware(), (req, res) => {
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
            // User exists, return the existing user details
            res.json({ message: "User synced", user: result[0] });
        } else {
            // User doesn't exist, create a new record
            const insertSql = "INSERT INTO users (name, email, password, phone_number) VALUES (?, ?, ?, ?)";
            const dummyPassword = "FIREBASE_AUTH_USER"; 
            db.query(insertSql, [name || 'Customer', email, dummyPassword, phone_number || null], (err, insertResult) => {
                if (err) {
                    console.error("Sync insert error:", err.message);
                    return res.status(500).json({ error: "Failed to create user record." });
                }
                res.json({ 
                    message: "User created and synced", 
                    user: { id: insertResult.insertId, name: name || 'Customer', email } 
                });
            });
        }
    });
});

// GET USER BY ID
router.get("/:id", authMiddleware(), (req, res) => {
    const { id } = req.params;
    if (!checkOwnership(req, res, id)) return;

    db.query("SELECT id, name, email, phone_number, gender, profile_image, created_at FROM users WHERE id = ?", [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!result || result.length === 0) return res.status(404).json({ error: "User not found." });
        res.json(result[0]);
    });
});

// UPDATE USER PROFILE
router.put("/:id", authMiddleware(), (req, res) => {
    const { id } = req.params;
    if (!checkOwnership(req, res, id)) return;
    const { name, phone_number, gender, profile_image } = req.body;

    if (!name) {
        return res.status(400).json({ error: "Name is required." });
    }

    const sql = "UPDATE users SET name = ?, phone_number = ?, gender = ?, profile_image = ? WHERE id = ?";
    const params = [name, phone_number || null, gender || null, profile_image || null, id];

    db.query(sql, params, (err, result) => {
        if (err) {
            console.error("Update profile error:", err.message);
            return res.status(500).json({ error: "Failed to update profile." });
        }
        res.json({ message: "Profile updated successfully" });
    });
});

// --- ADDRESS MANAGEMENT ---

// GET ALL ADDRESSES FOR A USER
router.get("/:id/addresses", authMiddleware(), (req, res) => {
    const userId = req.params.id;
    if (!checkOwnership(req, res, userId)) return;
    const sql = "SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC";
    db.query(sql, [userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ADD NEW ADDRESS
router.post("/:id/addresses", authMiddleware(), (req, res) => {
    const userId = req.params.id;
    if (!checkOwnership(req, res, userId)) return;
    const { house, street, city, state, pincode, type, is_default } = req.body;

    if (!house || !street || !city || !state || !pincode) {
        return res.status(400).json({ error: "Missing required address fields." });
    }

    const addAddress = () => {
        const sql = "INSERT INTO addresses (user_id, house, street, city, state, pincode, type, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        db.query(sql, [userId, house, street, city, state, pincode, type || 'Home', is_default ? 1 : 0], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Address added successfully", addressId: result.insertId });
        });
    };

    if (is_default) {
        db.query("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [userId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            addAddress();
        });
    } else {
        addAddress();
    }
});

// UPDATE ADDRESS
router.put("/:id/addresses/:addressId", authMiddleware(), (req, res) => {
    const { addressId } = req.params;
    const userId = req.params.id;
    if (!checkOwnership(req, res, userId)) return;
    const { house, street, city, state, pincode, type, is_default } = req.body;

    const updateAddr = () => {
        const sql = "UPDATE addresses SET house = ?, street = ?, city = ?, state = ?, pincode = ?, type = ?, is_default = ? WHERE id = ? AND user_id = ?";
        db.query(sql, [house, street, city, state, pincode, type, is_default ? 1 : 0, addressId, userId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Address updated successfully" });
        });
    };

    if (is_default) {
        db.query("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [userId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            updateAddr();
        });
    } else {
        updateAddr();
    }
});

// SET DEFAULT ADDRESS (dedicated simple route)
router.patch("/:id/addresses/:addressId/default", authMiddleware(), (req, res) => {
    const userId = req.params.id;
    const addressId = req.params.addressId;
    if (!checkOwnership(req, res, userId)) return;

    // First, clear all defaults for this user
    db.query("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        // Then set the chosen one as default
        db.query("UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?", [addressId, userId], (err2, result) => {
            if (err2) return res.status(500).json({ error: err2.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: "Address not found." });
            res.json({ message: "Default address updated successfully" });
        });
    });
});

// DELETE ADDRESS
router.delete("/:id/addresses/:addressId", authMiddleware(), (req, res) => {
    const { id, addressId } = req.params;
    if (!checkOwnership(req, res, id)) return;
    db.query("DELETE FROM addresses WHERE id = ? AND user_id = ?", [addressId, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Address deleted successfully" });
    });
});

module.exports = router;