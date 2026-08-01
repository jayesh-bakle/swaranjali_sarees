// API endpoint test script
const http = require('http');

const BASE = 'http://localhost:5000';

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch {}
        resolve({ status: res.statusCode, data: json, body: body.slice(0, 200) });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function test() {
  const results = [];

  // 1. Root endpoint
  let r = await request('GET', '/');
  results.push(['GET /', r.status, r.data?.message || r.body]);

  // 2. Get products (public)
  r = await request('GET', '/api/products');
  results.push(['GET /api/products', r.status, `products: ${r.data?.products?.length || 0}`]);

  // 3. Get categories (public)
  r = await request('GET', '/api/categories');
  results.push(['GET /api/categories', r.status, `categories: ${r.data?.categories?.length || 0}`]);

  // 4. Register a test user
  const email = `test_${Date.now()}@test.com`;
  r = await request('POST', '/api/auth/register', { name: 'Test User', email, password: 'test123' });
  results.push(['POST /api/auth/register', r.status, r.data?.message || r.data?.token ? 'user created' : r.data?.error || r.body]);

  // 5. Login admin
  r = await request('POST', '/api/auth/login', { email: 'admin@sarees.com', password: 'admin123' });
  const adminToken = r.data?.token;
  results.push(['POST /api/auth/login (admin)', r.status, adminToken ? `token: ${adminToken.slice(0, 20)}...` : r.data?.message || r.body]);

  // 6. Login test user
  r = await request('POST', '/api/auth/login', { email, password: 'test123' });
  const userToken = r.data?.token;
  results.push(['POST /api/auth/login (user)', r.status, userToken ? `token: ${userToken.slice(0, 20)}...` : r.data?.message || r.body]);

  // 7. Get /api/auth/me
  r = await request('GET', '/api/auth/me', null, userToken);
  results.push(['GET /api/auth/me', r.status, r.data?.user?.email || r.data?.message || r.body]);

  // 8. Get admin dashboard stats
  r = await request('GET', '/api/admin/stats', null, adminToken);
  results.push(['GET /api/admin/stats', r.status, r.data?.stats ? `revenue: ${r.data.stats.total_revenue} orders: ${r.data.stats.total_orders} low_stock: ${r.data.stats.low_stock}` : r.data?.message || r.body]);

  // 9. Get admin products (list all via /api/products?limit=100)
  r = await request('GET', '/api/products?limit=100', null, adminToken);
  results.push(['GET /api/products?limit=100 (admin)', r.status, `products: ${r.data?.products?.length || 0}`]);

  // 10. Get admin orders (/api/orders/all)
  r = await request('GET', '/api/orders/all', null, adminToken);
  results.push(['GET /api/orders/all (admin)', r.status, `orders: ${r.data?.orders?.length || 0}`]);

  // 11. Get categories (public /api/categories)
  r = await request('GET', '/api/categories');
  results.push(['GET /api/categories (public)', r.status, `categories: ${r.data?.categories?.length || 0}`]);

  // 12. Create a category (admin POST /api/categories)
  r = await request('POST', '/api/categories', { name: `Test Cat ${Date.now()}`, description: 'Test' }, adminToken);
  const catId = r.data?.category?.id;
  results.push(['POST /api/categories (admin)', r.status, `category id: ${catId || r.data?.message || r.body}`]);

  // 13. Get product by id
  r = await request('GET', '/api/products/1');
  results.push(['GET /api/products/1', r.status, r.data?.product?.name || r.data?.message || r.body]);

  // 14. Get orders (user's own)
  r = await request('GET', '/api/orders', null, userToken);
  results.push(['GET /api/orders (user)', r.status, `orders: ${r.data?.orders?.length || 0}`]);

  // 15. Wishlist - add product
  r = await request('POST', '/api/wishlist/1', null, userToken);
  results.push(['POST /api/wishlist/1', r.status, r.data?.message || r.body]);

  // 16. Wishlist - get
  r = await request('GET', '/api/wishlist', null, userToken);
  results.push(['GET /api/wishlist', r.status, `items: ${r.data?.items?.length || 0}`]);

  // 17. Addresses - create
  r = await request('POST', '/api/addresses', {
    full_name: 'Test User', phone: '9876543210',
    address_line1: '123 Main St', city: 'Mumbai',
    state: 'MH', postal_code: '400001', country: 'India', is_default: true
  }, userToken);
  const addrId = r.data?.address?.id;
  results.push(['POST /api/addresses', r.status, `address id: ${addrId || r.data?.message || r.body}`]);

  // 18. Addresses - get
  r = await request('GET', '/api/addresses', null, userToken);
  results.push(['GET /api/addresses', r.status, `addresses: ${r.data?.addresses?.length || 0}`]);

  // 19. Create an order
  const items = [{ id: 1, name: 'Banarasi Silk Saree', price: 199.99, quantity: 1, image: '/uploads/placeholder.jpg', fabric: 'Pure Silk', color: 'Maroon & Gold' }];
  r = await request('POST', '/api/orders', {
    items, total: 199.99,
    shipping_address: 'Test User, 123 Main St, Mumbai, MH 400001, India',
    phone: '9876543210', payment_method: 'cod'
  }, userToken);
  const orderId = r.data?.order?.id;
  results.push(['POST /api/orders', r.status, `order id: ${orderId || r.data?.message || r.body}`]);

  // 20. Get order by id (track)
  if (orderId) {
    r = await request('GET', `/api/orders/${orderId}`, null, userToken);
    results.push([`GET /api/orders/${orderId}`, r.status, r.data?.order ? `status: ${r.data.order.status} tracking: ${r.data.tracking?.length || 0}` : r.data?.message || r.body]);
  }

  // 21. Cancel order
  if (orderId) {
    r = await request('PUT', `/api/orders/cancel/${orderId}`, null, userToken);
    results.push([`PUT /api/orders/cancel/${orderId}`, r.status, r.data?.order?.status || r.data?.message || r.body]);
  }

  // 22. Reviews - create (POST /api/reviews with product_id in body)
  r = await request('POST', '/api/reviews', { product_id: 1, rating: 5, comment: 'Beautiful saree!' }, userToken);
  results.push(['POST /api/reviews', r.status, r.data?.message || r.data?.review ? 'review added' : r.data?.error || r.body]);

  // 23. Reviews - get (GET /api/reviews/product/1)
  r = await request('GET', '/api/reviews/product/1');
  results.push(['GET /api/reviews/product/1', r.status, `reviews: ${r.data?.reviews?.length || 0}`]);

  // 24. Admin - update order payment status
  if (orderId) {
    r = await request('PUT', `/api/orders/${orderId}/payment`, { payment_status: 'failed' }, adminToken);
    results.push([`PUT /api/orders/${orderId}/payment`, r.status, r.data?.order?.payment_status || r.data?.message || r.body]);

    r = await request('PUT', `/api/orders/${orderId}/payment`, { payment_status: 'refunded' }, adminToken);
    results.push([`PUT /api/orders/${orderId}/payment`, r.status, r.data?.order?.payment_status || r.data?.message || r.body]);
  }

  // 25. Update stock (admin) - POST /api/products/:id/stock
  r = await request('POST', '/api/products/1/stock', { stock: 50 }, adminToken);
  results.push(['POST /api/products/1/stock', r.status, r.data?.product?.stock !== undefined ? `stock: ${r.data.product.stock}` : r.data?.message || r.body]);

  // 26. Cleanup - delete category (DELETE /api/categories/:id)
  if (catId) {
    r = await request('DELETE', `/api/categories/${catId}`, null, adminToken);
    results.push([`DELETE /api/categories/${catId}`, r.status, r.data?.message || `deleted`]);
  }

  // Print results
  console.log('\n=== API TEST RESULTS ===\n');
  let pass = 0, fail = 0;
  for (const [name, status, info] of results) {
    const ok = status >= 200 && status < 400;
    if (ok) pass++; else fail++;
    console.log(`${ok ? '✅' : '❌'} ${name.padEnd(42)} → ${status} ${info || ''}`);
  }
  console.log(`\n${pass} passed, ${fail} failed (of ${results.length} total)`);
}

test().catch((err) => {
  console.error('Test failed to connect:', err.message);
  console.error('Is the backend server running on port 5000?');
  process.exit(1);
});