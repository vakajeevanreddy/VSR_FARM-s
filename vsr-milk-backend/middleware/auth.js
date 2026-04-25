const jwt = require('jsonwebtoken');

const authMiddleware = (roles = []) => {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization token required' });
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'VSR_SECRET_KEY_2024');
            req.user = decoded;

            // Role-based check
            if (roles.length && !roles.includes(decoded.role)) {
                return res.status(403).json({ error: 'Access denied: Unauthorized role' });
            }

            next();
        } catch (err) {
            console.error('JWT Verification Error:', err.message);
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
    };
};

module.exports = authMiddleware;
