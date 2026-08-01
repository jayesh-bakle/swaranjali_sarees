const express = require('express');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// All routes require admin
router.use(auth, (req, res, next) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  next();
});

// GET /api/admin/stats - Dashboard statistics
router.get('/stats', (req, res) => {
  const queries = {
    total_revenue: `SELECT COALESCE(SUM(total), 0) as value FROM orders WHERE status != 'cancelled'`,
    total_orders: `SELECT COUNT(*) as value FROM orders`,
    total_products: `SELECT COUNT(*) as value FROM products`,
    total_customers: `SELECT COUNT(*) as value FROM users WHERE is_admin = 0`,
    low_stock: `SELECT COUNT(*) as value FROM products WHERE stock <= 5`,
    out_of_stock: `SELECT COUNT(*) as value FROM products WHERE stock = 0`,
    pending_orders: `SELECT COUNT(*) as value FROM orders WHERE status IN ('pending', 'confirmed', 'processing')`,
    delivered_orders: `SELECT COUNT(*) as value FROM orders WHERE status = 'delivered'`
  };

  const results = {};
  let pending = Object.keys(queries).length;

  Object.entries(queries).forEach(([key, sql]) => {
    db.get(sql, (err, row) => {
      if (!err) results[key] = row.value;
      else results[key] = 0;
      pending--;
      if (pending === 0) {
        res.json({ stats: results });
      }
    });
  });
});

// GET /api/admin/revenue-trend - Revenue by month (last 6 months)
router.get('/revenue-trend', (req, res) => {
  db.all(
    `SELECT strftime('%Y-%m', created_at) as month,
            COUNT(*) as orders,
            COALESCE(SUM(total), 0) as revenue
     FROM orders
     WHERE status != 'cancelled' AND created_at >= datetime('now', '-6 months')
     GROUP BY strftime('%Y-%m', created_at)
     ORDER BY month ASC`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Server error', error: err.message });
      res.json({ trend: rows });
    }
  );
});

// GET /api/admin/top-products - Top selling products
router.get('/top-products', (req, res) => {
  db.all(
    `SELECT p.id, p.name, p.image_url, p.price, p.stock,
            SUM(CASE WHEN o.status != 'cancelled' THEN 1 ELSE 0 END) as orders_count,
            COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total ELSE 0 END), 0) as revenue
     FROM products p
     LEFT JOIN (
       SELECT id, status, total FROM orders, json_each(orders.items) as items
     ) o ON 1=1
     GROUP BY p.id
     ORDER BY revenue DESC
     LIMIT 10`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Server error', error: err.message });
      res.json({ products: rows });
    }
  );
});

// GET /api/admin/recent-orders - Recent orders
router.get('/recent-orders', (req, res) => {
  db.all(
    `SELECT o.*, u.name as customer_name FROM orders o
     JOIN users u ON u.id = o.user_id
     ORDER BY o.created_at DESC
     LIMIT 10`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Server error', error: err.message });
      const orders = rows.map((o) => ({ ...o, items: JSON.parse(o.items) }));
      res.json({ orders });
    }
  );
});

// GET /api/admin/inventory-report - Full inventory report
router.get('/inventory-report', (req, res) => {
  db.all(
    `SELECT p.id, p.name, p.category, p.price, p.stock, p.is_featured,
            p.sale_price, p.image_url,
            (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) as review_count,
            (SELECT AVG(rating) FROM reviews r WHERE r.product_id = p.id) as avg_rating
     FROM products p
     ORDER BY p.stock ASC`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Server error', error: err.message });
      res.json({ products: rows });
    }
  );
});

// GET /api/admin/users - All users (customers)
router.get('/users', (req, res) => {
  db.all(
    `SELECT u.id, u.name, u.email, u.is_admin, u.created_at,
            (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) as order_count,
            (SELECT COALESCE(SUM(total), 0) FROM orders o WHERE o.user_id = u.id AND o.status != 'cancelled') as total_spent
     FROM users u
     ORDER BY u.created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Server error', error: err.message });
      res.json({ users: rows });
    }
  );
});

// GET /api/admin/category-report - Category-wise sales
router.get('/category-report', (req, res) => {
  db.all(
    `SELECT category, COUNT(*) as product_count,
            COALESCE(SUM(stock), 0) as total_stock,
            COALESCE(SUM(stock * price), 0) as stock_value
     FROM products
     GROUP BY category
     ORDER BY product_count DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Server error', error: err.message });
      res.json({ categories: rows });
    }
  );
});

module.exports = router;