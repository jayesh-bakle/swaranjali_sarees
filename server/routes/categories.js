const express = require('express');
const db = require('../db');
const { auth, admin } = require('../middleware/auth');

const router = express.Router();

// GET /api/categories - List all categories with product counts
router.get('/', (req, res) => {
  db.all(
    `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category = c.name) as product_count
     FROM categories c ORDER BY c.name ASC`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Server error', error: err.message });
      res.json({ categories: rows });
    }
  );
});

// POST /api/categories - Create category (admin only)
router.post('/', auth, admin, (req, res) => {
  const { name, description, image_url } = req.body;
  if (!name) return res.status(400).json({ message: 'Category name is required' });

  db.run(
    'INSERT OR IGNORE INTO categories (name, description, image_url) VALUES (?, ?, ?)',
    [name, description || '', image_url || ''],
    function (err) {
      if (err) return res.status(500).json({ message: 'Server error', error: err.message });
      if (this.changes === 0) return res.status(400).json({ message: 'Category already exists' });
      const id = this.lastID;
      db.get('SELECT * FROM categories WHERE id = ?', [id], (getErr, category) => {
        res.status(201).json({ message: 'Category created!', category });
      });
    }
  );
});

// PUT /api/categories/:id - Update category (admin only)
router.put('/:id', auth, admin, (req, res) => {
  const id = Number(req.params.id);
  const { name, description, image_url } = req.body;

  db.get('SELECT * FROM categories WHERE id = ?', [id], (err, existing) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    if (!existing) return res.status(404).json({ message: 'Category not found' });

    db.run(
      'UPDATE categories SET name = ?, description = ?, image_url = ? WHERE id = ?',
      [name || existing.name, description !== undefined ? description : existing.description, image_url !== undefined ? image_url : existing.image_url, id],
      (updateErr) => {
        if (updateErr) return res.status(500).json({ message: 'Server error', error: updateErr.message });
        db.get('SELECT * FROM categories WHERE id = ?', [id], (getErr, category) => {
          res.json({ message: 'Category updated!', category });
        });
      }
    );
  });
});

// DELETE /api/categories/:id - Delete category (admin only)
router.delete('/:id', auth, admin, (req, res) => {
  const id = Number(req.params.id);
  db.get('SELECT * FROM categories WHERE id = ?', [id], (err, existing) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    if (!existing) return res.status(404).json({ message: 'Category not found' });
    db.run('DELETE FROM categories WHERE id = ?', [id], (deleteErr) => {
      if (deleteErr) return res.status(500).json({ message: 'Server error', error: deleteErr.message });
      res.json({ message: 'Category deleted' });
    });
  });
});

module.exports = router;