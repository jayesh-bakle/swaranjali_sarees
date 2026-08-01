const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me-in-production';

// Middleware to verify JWT token
exports.auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided, authorization denied' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      is_admin: decoded.is_admin || 0
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Middleware to verify admin role
exports.admin = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  next();
};

// Generate JWT token
exports.generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      is_admin: user.is_admin || 0
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};