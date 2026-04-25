const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const router = express.Router();

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'vsr_farms_secret_key_2024';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Owner Login
router.post('/owner/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Check if owner exists
        const [owners] = await db.execute(
            'SELECT * FROM users WHERE email = ? AND email = "vsrmilkproducts@gmail.com"',
            [email]
        );

        if (owners.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const owner = owners[0];

        // Verify password (assuming it's already hashed in DB)
        const isValidPassword = await bcrypt.compare(password, owner.password);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: owner.id,
                email: owner.email,
                name: owner.name,
                role: 'owner'
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Log login activity
        await db.execute(
            'INSERT INTO user_activity (user_id, login_time) VALUES (?, NOW())',
            [owner.id]
        );

        res.json({
            success: true,
            message: 'Owner login successful',
            token,
            user: {
                id: owner.id,
                name: owner.name,
                email: owner.email,
                role: 'owner'
            }
        });

    } catch (error) {
        console.error('Owner login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Customer Registration
router.post('/customer/register', async (req, res) => {
    try {
        const { name, email, phone_number, password } = req.body;

        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        // Check if user already exists
        const [existingUsers] = await db.execute(
            'SELECT id FROM users WHERE email = ? OR phone_number = ?',
            [email, phone_number || null]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({ error: 'User already exists with this email or phone number' });
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert new user
        const [result] = await db.execute(
            'INSERT INTO users (name, email, phone_number, password) VALUES (?, ?, ?, ?)',
            [name, email, phone_number || null, hashedPassword]
        );

        // Generate JWT token
        const token = jwt.sign(
            {
                id: result.insertId,
                email,
                name,
                role: 'customer'
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            success: true,
            message: 'Customer registration successful',
            token,
            user: {
                id: result.insertId,
                name,
                email,
                phone_number,
                role: 'customer'
            }
        });

    } catch (error) {
        console.error('Customer registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Customer Login
router.post('/customer/login', async (req, res) => {
    try {
        const { email, phone_number, password } = req.body;

        // Validate input
        if (!password || (!email && !phone_number)) {
            return res.status(400).json({ error: 'Password and either email or phone number are required' });
        }

        // Find user
        let query, params;
        if (email) {
            query = 'SELECT * FROM users WHERE email = ?';
            params = [email];
        } else {
            query = 'SELECT * FROM users WHERE phone_number = ?';
            params = [phone_number];
        }

        const [users] = await db.execute(query, params);

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                name: user.name,
                role: 'customer'
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Log login activity
        await db.execute(
            'INSERT INTO user_activity (user_id, login_time) VALUES (?, NOW())',
            [user.id]
        );

        res.json({
            success: true,
            message: 'Customer login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone_number: user.phone_number,
                role: 'customer'
            }
        });

    } catch (error) {
        console.error('Customer login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Send OTP for phone login (placeholder - implement SMS service)
router.post('/customer/send-otp', async (req, res) => {
    try {
        const { phone_number } = req.body;

        if (!phone_number) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // Check if user exists
        const [users] = await db.execute(
            'SELECT id FROM users WHERE phone_number = ?',
            [phone_number]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found. Please register first.' });
        }

        // Generate OTP (in production, use a proper OTP service)
        const otp = Math.floor(100000 + Math.random() * 900000);

        // Store OTP temporarily (in production, use Redis or similar)
        // For now, we'll just return success
        // In a real implementation, you'd send SMS and store OTP with expiry

        res.json({
            success: true,
            message: 'OTP sent successfully',
            otp: otp // Remove this in production - only for testing
        });

    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Verify OTP and login
router.post('/customer/verify-otp', async (req, res) => {
    try {
        const { phone_number, otp } = req.body;

        if (!phone_number || !otp) {
            return res.status(400).json({ error: 'Phone number and OTP are required' });
        }

        // Find user
        const [users] = await db.execute(
            'SELECT * FROM users WHERE phone_number = ?',
            [phone_number]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[0];

        // In production, verify OTP from stored value
        // For now, accept any 6-digit OTP

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                name: user.name,
                role: 'customer'
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Log login activity
        await db.execute(
            'INSERT INTO user_activity (user_id, login_time) VALUES (?, NOW())',
            [user.id]
        );

        res.json({
            success: true,
            message: 'OTP verification successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone_number: user.phone_number,
                role: 'customer'
            }
        });

    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout (log activity)
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        // Log logout activity
        await db.execute(
            'UPDATE user_activity SET logout_time = NOW() WHERE user_id = ? AND logout_time IS NULL ORDER BY login_time DESC LIMIT 1',
            [req.user.id]
        );

        res.json({ success: true, message: 'Logout successful' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const [users] = await db.execute(
            'SELECT id, name, email, phone_number, created_at FROM users WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true, user: users[0] });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin stats (for owner dashboard)
router.get('/admin/stats', authenticateToken, async (req, res) => {
    try {
        // Check if user is owner
        if (req.user.role !== 'owner') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get various stats
        const [userCount] = await db.execute('SELECT COUNT(*) as count FROM users WHERE email != "vsrmilkproducts@gmail.com"');
        const [orderCount] = await db.execute('SELECT COUNT(*) as count FROM orders');
        const [totalRevenue] = await db.execute('SELECT SUM(transaction_amount) as total FROM orders WHERE order_status != "cancelled"');
        const [recentOrders] = await db.execute(`
            SELECT o.*, u.name as customer_name
            FROM orders o
            JOIN users u ON o.user_id = u.id
            ORDER BY o.transaction_date DESC
            LIMIT 10
        `);

        res.json({
            success: true,
            stats: {
                totalCustomers: userCount[0].count,
                totalOrders: orderCount[0].count,
                totalRevenue: totalRevenue[0].total || 0,
                recentOrders: recentOrders
            }
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;


