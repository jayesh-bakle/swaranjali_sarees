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
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  // Validation
  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Please provide your name' });
  }
  if (String(name).length > 60) {
    return res.status(400).json({ message: 'Name must be 60 characters or fewer' });
  }
  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide name, email, and password' });
  }
  if (password.length < 8 || password.length > 72) {
    return res.status(400).json({ message: 'Password must be 8-72 characters' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Please provide a valid email address' });
  }

  const cleanName = String(name).trim();
  const cleanEmail = String(email).trim().toLowerCase();

  // Check if user already exists (best-effort; the UNIQUE constraint is the source of truth)
  db.get('SELECT id FROM users WHERE email = ?', [cleanEmail], async (err, row) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (row) return res.status(409).json({ message: 'An account with this email already exists' });

    try {
      const passwordHash = await bcrypt.hash(password, 10); // async — doesn't block the event loop
      db.run(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
        [cleanName, cleanEmail, passwordHash],
        function (insertErr) {
          if (insertErr) {
            // Concurrent duplicate registration → the UNIQUE constraint fires → 409, not 500
            if (insertErr.code === 'SQLITE_CONSTRAINT' || insertErr.message?.includes('UNIQUE')) {
              return res.status(409).json({ message: 'An account with this email already exists' });
            }
            return res.status(500).json({ message: 'Server error' });
          }

          const userId = this.lastID;
          const user = { id: userId, name: cleanName, email: cleanEmail, is_admin: 0, created_at: new Date().toISOString() };
          const token = generateToken({ id: userId, email: cleanEmail, name: cleanName, is_admin: 0 });
          res.status(201).json({ message: 'Account created successfully!', token, user: sanitizeUser(user) });
        }
      );
    } catch (hashErr) {
      return res.status(500).json({ message: 'Server error' });
    }
  });
});

// POST /api/auth/login - Login user
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [String(email).trim().toLowerCase()], async (err, user) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    try {
      const isMatch = await bcrypt.compare(password, user.password_hash); // async
      if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

      const token = generateToken(user);
      // Flag the well-known seeded admin credential so the client can force a change
      const defaultPassword = user.email === 'admin@sarees.com' && password === 'admin123';
      res.json({ message: 'Login successful!', token, default_password: defaultPassword, user: sanitizeUser(user) });
    } catch (_) {
      return res.status(500).json({ message: 'Server error' });
    }
  });
});

// GET /api/auth/me - Get current logged-in user
router.get('/me', auth, (req, res) => {
  db.get('SELECT id, name, email, is_admin, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: sanitizeUser(user) });
  });
});

// GET /api/auth/users - List all users (admin only)
router.get('/users', auth, (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  db.all('SELECT id, name, email, is_admin, created_at FROM users ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    res.json({ users: rows.map(sanitizeUser) });
  });
});

// PUT /api/auth/password - Change password (verifies the current password first).
// Rotating the password is the key mitigation for the seeded admin credential.
router.put('/password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Provide your current password and a new password' });
  }
  if (newPassword.length < 8 || newPassword.length > 72) {
    return res.status(400).json({ message: 'New password must be 8-72 characters' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ message: 'New password must be different from the current one' });
  }

  db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!user) return res.status(404).json({ message: 'User not found' });

    try {
      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

      const passwordHash = await bcrypt.hash(newPassword, 10);
      db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id], (upErr) => {
        if (upErr) return res.status(500).json({ message: 'Server error' });
        // Issue a fresh token so the change is immediately reflected
        const token = generateToken(user);
        res.json({ message: 'Password updated successfully!', token, user: sanitizeUser(user) });
      });
    } catch (_) {
      return res.status(500).json({ message: 'Server error' });
    }
  });
});

module.exports = router;
