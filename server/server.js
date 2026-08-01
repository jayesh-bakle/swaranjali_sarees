const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize database (creates tables & seeds admin)
require('./db');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const wishlistRoutes = require('./routes/wishlist');
const reviewRoutes = require('./routes/reviews');
const addressRoutes = require('./routes/addresses');
const categoryRoutes = require('./routes/categories');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin', adminRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🛍️ Saree Shopping API is running!',
    endpoints: {
      auth: ['POST /api/auth/register', 'POST /api/auth/login', 'GET /api/auth/me'],
      products: ['GET /api/products', 'GET /api/products/:id', 'GET /api/products/featured', 'GET /api/products/related/:id', 'POST /api/products (admin)', 'PUT /api/products/:id (admin)', 'DELETE /api/products/:id (admin)', 'POST /api/products/:id/stock (admin)'],
      orders: ['POST /api/orders', 'GET /api/orders', 'GET /api/orders/all (admin)', 'GET /api/orders/:id', 'PUT /api/orders/cancel/:id', 'PUT /api/orders/:id/status (admin)', 'PUT /api/orders/:id/payment (admin)'],
      wishlist: ['GET /api/wishlist', 'POST /api/wishlist/:productId', 'DELETE /api/wishlist/:productId', 'GET /api/wishlist/check/:productId'],
      reviews: ['GET /api/reviews/product/:productId', 'GET /api/reviews/product/:productId/summary', 'POST /api/reviews', 'DELETE /api/reviews/:id'],
      addresses: ['GET /api/addresses', 'POST /api/addresses', 'PUT /api/addresses/:id', 'DELETE /api/addresses/:id', 'PUT /api/addresses/:id/default'],
      categories: ['GET /api/categories', 'POST /api/categories (admin)', 'PUT /api/categories/:id (admin)', 'DELETE /api/categories/:id (admin)'],
      admin: ['GET /api/admin/stats', 'GET /api/admin/revenue-trend', 'GET /api/admin/top-products', 'GET /api/admin/recent-orders', 'GET /api/admin/inventory-report', 'GET /api/admin/users', 'GET /api/admin/category-report']
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  if (err.message && err.message.includes('Only image files')) {
    return res.status(400).json({ message: err.message });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'Image file is too large. Maximum size is 5MB.' });
  }
  res.status(500).json({ message: 'Server error', error: err.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`   API docs: http://localhost:${PORT}/`);
  console.log(`   Uploaded images: http://localhost:${PORT}/uploads/`);
});