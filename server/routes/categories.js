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
      if (err) return res.status(500).json({ message: 'Server error' });
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
      if (err) return res.status(500).json({ message: 'Server error' });
      if (this.changes === 0) return res.status(400).json({ message: 'Category already exists' });
      const id = this.lastID;
      db.get('SELECT * FROM categories WHERE id = ?', [id], (getErr, category) => {
        res.status(201).json({ message: 'Category created!', category });
      });
    }
  );
});

// PUT /api/categories/:id - Update category (admin only).
// Renaming also renames the category on every product that references it (products store the category by name).
router.put('/:id', auth, admin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid category id' });
  const { name, description, image_url } = req.body;
  if (name !== undefined && (!String(name).trim() || String(name).length > 60)) {
    return res.status(400).json({ message: 'Category name must be 1-60 characters' });
  }

  db.get('SELECT * FROM categories WHERE id = ?', [id], (err, existing) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!existing) return res.status(404).json({ message: 'Category not found' });

    const newName = name ? String(name).trim() : existing.name;
    db.run(
      'UPDATE categories SET name = ?, description = ?, image_url = ? WHERE id = ?',
      [newName, description !== undefined ? description : existing.description, image_url !== undefined ? image_url : existing.image_url, id],
      (updateErr) => {
        if (updateErr) return res.status(500).json({ message: 'Server error' });
        // Propagate the rename to products that reference the old name
        if (newName !== existing.name) {
          db.run('UPDATE products SET category = ? WHERE category = ?', [newName, existing.name], () => {});
        }
        db.get('SELECT * FROM categories WHERE id = ?', [id], (getErr, category) => {
          res.json({ message: 'Category updated!', category });
        });
      }
    );
  });
});

// DELETE /api/categories/:id - Delete category (admin only).
// Products that reference it are moved to "General" instead of being orphaned.
router.delete('/:id', auth, admin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid category id' });
  db.get('SELECT * FROM categories WHERE id = ?', [id], (err, existing) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!existing) return res.status(404).json({ message: 'Category not found' });
    db.run('UPDATE products SET category = ? WHERE category = ?', ['General', existing.name], (updErr) => {
      if (updErr) return res.status(500).json({ message: 'Server error' });
      db.run('DELETE FROM categories WHERE id = ?', [id], (deleteErr) => {
        if (deleteErr) return res.status(500).json({ message: 'Server error' });
        res.json({ message: 'Category deleted' });
      });
    });
  });
});

module.exports = router;