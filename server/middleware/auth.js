const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const dotenv = require('dotenv');
const db = require('../db');

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Fail closed — with the old hardcoded fallback, anyone could forge an admin token.
  throw new Error('JWT_SECRET is not set. Add a strong random JWT_SECRET to server/.env (see .env.example).');
}

// Middleware to verify JWT token (and reject tokens revoked via the blacklist)
exports.auth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided, authorization denied' });
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  // A token logged out / rotated by password change stays dead until it expires.
  db.get('SELECT 1 FROM token_blacklist WHERE jti = ?', [decoded.jti || ''], (err, row) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (row) return res.status(401).json({ message: 'Invalid or expired token' });

    // The seeded admin must rotate the default password before using the app. Only the
    // endpoints needed to complete the rotation (plus identity/logout) stay reachable.
    const ALLOWED_WITH_DEFAULT_PASSWORD = new Set(['/api/auth/password', '/api/auth/logout', '/api/auth/me']);
    const routePath = (req.baseUrl || '') + (req.path || '');
    if (decoded.default_password && !ALLOWED_WITH_DEFAULT_PASSWORD.has(routePath)) {
      return res.status(403).json({ message: 'You must change the default admin password before continuing.' });
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      is_admin: decoded.is_admin || 0,
      default_password: !!decoded.default_password,
      jti: decoded.jti,
      exp: decoded.exp,
    };
    next();
  });
};

// Middleware to verify admin role — and force the seeded admin to rotate the default password
exports.admin = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  if (req.user.default_password) {
    return res.status(403).json({ message: 'You must change the default admin password before using the admin panel.' });
  }
  next();
};

// Generate JWT token. Every token carries a unique jti (id) so it can be revoked
// server-side on logout / password change, and the default_password flag so the
// seeded admin account cannot use the app until its password is rotated.
exports.generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      is_admin: user.is_admin || 0,
      default_password: user.default_password || false,
      jti: crypto.randomUUID(),
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};
