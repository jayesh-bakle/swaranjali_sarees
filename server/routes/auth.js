const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { auth, generateToken } = require('../middleware/auth');

const router = express.Router();

// Helper to sanitize user object (never send password hash)
const sanitizeUser = (user = {}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  is_admin: user.is_admin,
  created_at: user.created_at
});

// POST /api/auth/register - Register a new user
router.post('/register', (req, res) => {
  const { name, email, password } = req.body;

  // Validation
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Please provide name, email, and password' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Please provide a valid email address' });
  }

  // Check if user already exists
  db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()], (err, row) => {
    if (err) {
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
    if (row) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    // Hash password and insert user
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    db.run(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email.toLowerCase(), passwordHash],
      function (insertErr) {
        if (insertErr) {
          return res.status(500).json({ message: 'Server error', error: insertErr.message });
        }

        const userId = this.lastID;
        const user = {
          id: userId,
          name,
          email: email.toLowerCase(),
          is_admin: 0,
          created_at: new Date().toISOString()
        };

        const token = generateToken({ id: userId, email: user.email, name, is_admin: 0 });
        res.status(201).json({
          message: 'Account created successfully!',
          token,
          user: sanitizeUser(user)
        });
      }
    );
  });
});

// POST /api/auth/login - Login user
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Compare password
    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user);
    res.json({
      message: 'Login successful!',
      token,
      user: sanitizeUser(user)
    });
  });
});

// GET /api/auth/me - Get current logged-in user
router.get('/me', auth, (req, res) => {
  db.get('SELECT id, name, email, is_admin, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user: sanitizeUser(user) });
  });
});

// GET /api/auth/users - List all users (admin only)
router.get('/users', auth, (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  db.all('SELECT id, name, email, is_admin, created_at FROM users ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
    res.json({ users: rows.map(sanitizeUser) });
  });
});

module.exports = router;