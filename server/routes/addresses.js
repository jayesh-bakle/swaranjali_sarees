const express = require('express');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/addresses - Get my addresses
router.get('/', auth, (req, res) => {
  db.all('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    res.json({ addresses: rows });
  });
});

// GET /api/addresses/:id - Get single address
router.get('/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  db.get('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [id, req.user.id], (err, row) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!row) return res.status(404).json({ message: 'Address not found' });
    res.json({ address: row });
  });
});

// POST /api/addresses - Create address
router.post('/', auth, (req, res) => {
  const { full_name, phone, address_line1, address_line2, city, state, postal_code, country, is_default } = req.body;
  if (!full_name || !phone || !address_line1 || !city || !state || !postal_code) {
    return res.status(400).json({ message: 'Please fill all required address fields' });
  }
  // Basic format validation (Indian phone = 10 digits, PIN = 6 digits)
  const phoneStr = String(phone).trim();
  if (!/^[6-9]\d{9}$/.test(phoneStr)) {
    return res.status(400).json({ message: 'Phone must be a valid 10-digit Indian mobile number' });
  }
  const pinStr = String(postal_code).trim();
  if (!/^\d{6}$/.test(pinStr)) {
    return res.status(400).json({ message: 'Postal code must be a valid 6-digit PIN' });
  }

  const doInsert = (makeDefault) => {
    db.run(
      `INSERT INTO addresses (user_id, full_name, phone, address_line1, address_line2, city, state, postal_code, country, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, full_name, phone, address_line1, address_line2 || '', city, state, postal_code, country || 'India', makeDefault ? 1 : 0],
      function (err) {
        if (err) return res.status(500).json({ message: 'Server error' });
        const id = this.lastID;
        db.get('SELECT * FROM addresses WHERE id = ?', [id], (getErr, address) => {
          res.status(201).json({ message: 'Address saved!', address });
        });
      }
    );
  };

  if (is_default || req.body.makeDefault) {
    db.run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id], (err) => {
      if (err) return res.status(500).json({ message: 'Server error' });
      doInsert(true);
    });
  } else {
    // If this is the first address, make it default
    db.get('SELECT COUNT(*) as count FROM addresses WHERE user_id = ?', [req.user.id], (err, row) => {
      if (err) return res.status(500).json({ message: 'Server error' });
      doInsert(row.count === 0);
    });
  }
});

// PUT /api/addresses/:id - Update address
router.put('/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid address id' });
  const { full_name, phone, address_line1, address_line2, city, state, postal_code, country, is_default } = req.body;

  if (phone && !/^[6-9]\d{9}$/.test(String(phone).trim())) {
    return res.status(400).json({ message: 'Phone must be a valid 10-digit Indian mobile number' });
  }
  if (postal_code && !/^\d{6}$/.test(String(postal_code).trim())) {
    return res.status(400).json({ message: 'Postal code must be a valid 6-digit PIN' });
  }

  db.get('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [id, req.user.id], (err, existing) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!existing) return res.status(404).json({ message: 'Address not found' });

    const updateDone = () => {
      db.run(
        `UPDATE addresses SET full_name = ?, phone = ?, address_line1 = ?, address_line2 = ?, city = ?, state = ?, postal_code = ?, country = ?, is_default = ?
         WHERE id = ?`,
        [
          full_name || existing.full_name,
          phone || existing.phone,
          address_line1 || existing.address_line1,
          address_line2 !== undefined ? address_line2 : existing.address_line2,
          city || existing.city,
          state || existing.state,
          postal_code || existing.postal_code,
          country || existing.country,
          is_default ? 1 : existing.is_default,
          id
        ],
        (updateErr) => {
          if (updateErr) return res.status(500).json({ message: 'Server error' });
          db.get('SELECT * FROM addresses WHERE id = ?', [id], (getErr, address) => {
            res.json({ message: 'Address updated!', address });
          });
        }
      );
    };

    if (is_default) {
      db.run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id], (err) => {
        if (err) return res.status(500).json({ message: 'Server error' });
        updateDone();
      });
    } else {
      updateDone();
    }
  });
});

// DELETE /api/addresses/:id - Delete address
router.delete('/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  db.run('DELETE FROM addresses WHERE id = ? AND user_id = ?', [id, req.user.id], function (err) {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (this.changes === 0) return res.status(404).json({ message: 'Address not found' });
    res.json({ message: 'Address deleted' });
  });
});

// PUT /api/addresses/:id/default - Set as default
router.put('/:id/default', auth, (req, res) => {
  const id = Number(req.params.id);
  db.get('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [id, req.user.id], (err, existing) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!existing) return res.status(404).json({ message: 'Address not found' });

    db.run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id], (err) => {
      if (err) return res.status(500).json({ message: 'Server error' });
      db.run('UPDATE addresses SET is_default = 1 WHERE id = ?', [id], (updateErr) => {
        if (updateErr) return res.status(500).json({ message: 'Server error' });
        res.json({ message: 'Default address updated!' });
      });
    });
  });
});

module.exports = router;