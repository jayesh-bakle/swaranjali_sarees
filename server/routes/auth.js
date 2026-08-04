const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { auth, generateToken } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../utils/email');

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

      // Flag the seeded admin credential (env-configurable) so the client can force a change
      const defaultAdminEmail = process.env.ADMIN_EMAIL || 'admin@sarees.com';
      const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const defaultPassword = user.email === defaultAdminEmail && password === defaultAdminPassword;
      // The JWT carries the flag so middleware can block the account until the password is rotated
      const token = generateToken({ ...user, default_password: defaultPassword });
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
        // Revoke the old token, then issue a fresh one without the default_password flag
        const finish = () => {
          const token = generateToken({ ...user, default_password: false });
          res.json({ message: 'Password updated successfully!', token, user: sanitizeUser(user) });
        };
        if (!req.user.jti) return finish();
        const expiresMs = req.user.exp ? req.user.exp * 1000 : Date.now() + 7 * 24 * 60 * 60 * 1000;
        db.run(
          'INSERT OR REPLACE INTO token_blacklist (jti, expires_at) VALUES (?, ?)',
          [req.user.jti, expiresMs],
          () => finish()
        );
      });
    } catch (_) {
      return res.status(500).json({ message: 'Server error' });
    }
  });
});

// POST /api/auth/logout - Revoke the current token server-side (takes effect immediately,
// even though the JWT itself is stateless and would otherwise stay valid until it expires).
router.post('/logout', auth, (req, res) => {
  if (!req.user.jti) return res.json({ message: 'Logged out successfully' });
  const expiresMs = req.user.exp ? req.user.exp * 1000 : Date.now() + 7 * 24 * 60 * 60 * 1000;
  db.run(
    'INSERT OR REPLACE INTO token_blacklist (jti, expires_at) VALUES (?, ?)',
    [req.user.jti, expiresMs],
    (err) => {
      if (err) return res.status(500).json({ message: 'Server error' });
      res.json({ message: 'Logged out successfully' });
    }
  );
});

// POST /api/auth/forgot-password - Request a password reset token.
// Always returns the same message to prevent email-enumeration.
const crypto = require('crypto');
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ message: 'If an account exists, a reset link has been sent.' });

  const lowerEmail = String(email).toLowerCase().trim();
  db.get('SELECT id FROM users WHERE email = ?', [lowerEmail], (err, user) => {
    // Always return the same response — don't reveal whether the email exists
    if (err || !user) return res.json({ message: 'If an account exists, a reset link has been sent.' });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = Date.now() + RESET_TTL_MS;

    // Invalidate any previous unused tokens for this user
    db.run('DELETE FROM reset_tokens WHERE user_id = ? AND used = 0', [user.id], () => {
      db.run(
        'INSERT INTO reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        [user.id, hash, expiresAt],
        (insertErr) => {
          if (insertErr) return res.json({ message: 'If an account exists, a reset link has been sent.' });
          // Email the reset link when SMTP is configured; always log it as a fallback
          // (the console line is also how you can grab the link during local dev).
          console.log(`🔑 Password reset token for ${lowerEmail}: /reset-password?token=${rawToken}`);
          sendPasswordResetEmail({ email: lowerEmail, resetToken: rawToken });
          res.json({ message: 'If an account exists, a reset link has been sent.' });
        }
      );
    });
  });
});

// POST /api/auth/reset-password - Reset password using the token from the email link.
router.post('/reset-password', (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ message: 'Token and new password are required' });
  if (password.length < 8 || password.length > 72) {
    return res.status(400).json({ message: 'Password must be between 8 and 72 characters' });
  }

  const hash = crypto.createHash('sha256').update(String(token)).digest('hex');
  db.get(
    'SELECT * FROM reset_tokens WHERE token_hash = ? AND used = 0 AND expires_at > ?',
    [hash, Date.now()],
    (err, row) => {
      if (err || !row) return res.status(400).json({ message: 'Invalid or expired reset token' });

      bcrypt.hash(password, 10, (hashErr, passwordHash) => {
        if (hashErr) return res.status(500).json({ message: 'Server error' });
        db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, row.user_id], (updateErr) => {
          if (updateErr) return res.status(500).json({ message: 'Server error' });
          // Mark the token as used
          db.run('UPDATE reset_tokens SET used = 1 WHERE id = ?', [row.id], () => {});
          res.json({ message: 'Password has been reset. You can now log in.' });
        });
      });
    }
  );
});

module.exports = router;
