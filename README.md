# 🛍️ SareeElegance — Full Stack E-Commerce App

A complete Amazon/Flipkart-style shopping application for selling sarees online, with customer shopping, online payments, and a full admin dashboard for stock & inventory management.

## ✨ Features

### 👤 Customer
- 🛒 Browse and shop sarees (search, filter by category, sort, pagination)
- 🔐 User registration & login (JWT auth)
- 🛍️ Shopping cart with quantity management
- 💳 Online payments via **Razorpay** (UPI, cards, netbanking, wallets) + Cash on Delivery
- ❤️ Wishlist / Saved items
- ⭐ Product ratings & reviews
- 📍 Saved shipping addresses
- 📦 Order history with live order tracking & cancellation
- 🏷️ Categories, featured products, related products

### 👑 Admin
- 📊 Dashboard with sales stats, revenue trends, top products, recent orders
- 🧾 Inventory management (low-stock alerts, stock adjustments)
- 🏷️ Product CRUD with image upload
- 🗂️ Category management
- 📋 Order management (status updates, payment tracking)
- 👥 Customer list
- 📈 Reports (category report, inventory report)

## 🏗️ Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | React (Vite) + Tailwind CSS         |
| Backend   | Node.js + Express                   |
| Database  | SQLite (file-based, no setup)       |
| Auth      | JWT + bcrypt                        |
| Payments  | Razorpay (UPI / Cards / NetBanking) |
| Uploads   | Multer (image upload)               |
| Hosting   | Render (one-click via render.yaml)  |

## 📁 Folder Structure

```
shoppingCart/
├── server/                  # Backend API
│   ├── server.js            # Entry point
│   ├── db.js                # SQLite database setup (auto-migrates & seeds)
│   ├── middleware/auth.js   # JWT auth middleware
│   ├── routes/              # API routes
│   │   ├── auth.js          # Register/Login/Profile
│   │   ├── products.js      # Product CRUD, search, filters
│   │   ├── orders.js        # Order create/list/track/cancel
│   │   ├── payments.js      # Razorpay create-order / verify / webhook
│   │   ├── wishlist.js      # Wishlist
│   │   ├── reviews.js       # Product reviews & ratings
│   │   ├── addresses.js     # Saved addresses
│   │   ├── categories.js    # Category CRUD
│   │   └── admin.js         # Admin dashboard stats & reports
│   ├── uploads/             # Uploaded saree images
│   ├── .env.example         # Server env template
│   └── Procfile             # Render/Heroku startup
├── client/                  # Frontend React app
│   ├── src/
│   │   ├── pages/           # Home, Shop, ProductDetail, Cart, Checkout,
│   │   │                    # Orders, Wishlist, Addresses, TrackOrder, Admin...
│   │   ├── components/      # Navbar, ProductCard, Footer, ...
│   │   ├── context/         # AuthContext, CartContext
│   │   └── api/client.js    # Axios API client
│   └── .env.example         # Frontend env template
└── render.yaml              # One-click deploy config (Render Blueprint)
```

## 🚀 Getting Started (Local Development)

### 1. Install Backend Dependencies

```bash
cd server
npm install
```

### 2. Configure Backend Environment

```bash
cp .env.example .env
# Set JWT_SECRET to a random long string
# Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (test keys from dashboard.razorpay.com)
```

### 3. Install Frontend Dependencies

```bash
cd client
npm install
```

### 4. Configure Frontend Environment

```bash
cp .env.example .env
# VITE_API_URL=http://localhost:5000/api
```

### 5. Start the Backend (port 5000)

```bash
cd server
npm run dev
```

### 6. Start the Frontend (port 5173)

```bash
cd client
npm run dev
```

### 7. Open the App

Visit **http://localhost:5173** in your browser.

## 👤 Default Admin User

The app seeds an admin account automatically on first run:

- **Email:** `admin@sarees.com`
- **Password:** `admin123`

Log in with these credentials and go to **Admin** to manage products, stock, and orders.

## 💳 Razorpay Payments

The app integrates [Razorpay](https://razorpay.com) for online payments:

1. **Create a Razorpay account** → [dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Go to **Settings → API Keys** and copy your **Key ID** + **Key Secret** (use test keys for development)
3. Add them to `server/.env`:
   ```
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
   ```
4. **Optional — Webhooks** for server-side payment confirmation:
   - Configure a webhook in the Razorpay dashboard → **Settings → Webhooks**
   - URL: `https://your-backend.onrender.com/api/payments/webhook`
   - Events: `payment.captured`
   - Copy the webhook secret into `RAZORPAY_WEBHOOK_SECRET`

**Test card:** use `4111 1111 1111 1111`, any future expiry, any CVV, OTP `1234`.

When Razorpay keys are **not** configured, the checkout gracefully falls back to **Cash on Delivery** so the app still works.

## ☁️ Deploy to Render (One-Click)

The repo includes a `render.yaml` **Blueprint** that deploys both the backend (Node + SQLite on a persistent disk) and the frontend (static SPA).

### Option A — Render Dashboard (Recommended)

1. Push this repo to GitHub.
2. In Render, click **New → Blueprint**.
3. Select the repo. Render reads `render.yaml` and creates both services automatically.
4. Set the missing env vars it asks for:
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - (`RAZORPAY_WEBHOOK_SECRET` optional)
5. The backend gets a 1 GB persistent disk at `/var/data` automatically, and `DATABASE_PATH=/var/data/sarees.db` keeps your data across deploys.

### Option B — Render Dashboard (Manual)

**Backend (Web Service)**
- Build Command: `npm install`
- Start Command: `node server.js`
- Root Directory: `server`
- Environment Variables:
  - `JWT_SECRET` (random long string)
  - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
  - `DATABASE_PATH=/var/data/sarees.db`
- Add a **Persistent Disk** mounted at `/var/data` (1 GB free tier)

**Frontend (Static Site)**
- Root Directory: `client`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Environment Variable: `VITE_API_URL=https://your-backend.onrender.com/api`

## 🔑 API Endpoints

### Auth
| Method | Endpoint            | Description              |
|--------|---------------------|--------------------------|
| POST   | `/api/auth/register`| Register a new user      |
| POST   | `/api/auth/login`   | Login & get JWT token    |
| GET    | `/api/auth/me`      | Get current user profile |

### Products
| Method | Endpoint                    | Description                 |
|--------|-----------------------------|-----------------------------|
| GET    | `/api/products`             | List products (search, filter, sort, pagination) |
| GET    | `/api/products/featured`    | Featured products           |
| GET    | `/api/products/related/:id` | Related products            |
| GET    | `/api/products/:id`         | Get single product          |
| POST   | `/api/products`             | Create product (admin)      |
| PUT    | `/api/products/:id`         | Update product (admin)      |
| DELETE | `/api/products/:id`         | Delete product (admin)      |
| POST   | `/api/products/:id/stock`   | Adjust stock (admin)        |

### Orders
| Method | Endpoint                  | Description                 |
|--------|---------------------------|-----------------------------|
| POST   | `/api/orders`             | Create an order             |
| GET    | `/api/orders`             | Get my orders               |
| GET    | `/api/orders/all`         | All orders (admin)          |
| GET    | `/api/orders/:id`         | Order detail + tracking     |
| PUT    | `/api/orders/cancel/:id`  | Cancel my order             |
| PUT    | `/api/orders/:id/status`  | Update status (admin)       |
| PUT    | `/api/orders/:id/payment` | Update payment (admin)      |

### Payments (Razorpay)
| Method | Endpoint              | Description                        |
|--------|-----------------------|------------------------------------|
| POST   | `/api/payments/create-order` | Create a Razorpay order     |
| POST   | `/api/payments/verify`       | Verify payment signature     |
| POST   | `/api/payments/webhook`      | Razorpay webhook (server-side) |

### Wishlist
| Method | Endpoint                 | Description               |
|--------|--------------------------|---------------------------|
| GET    | `/api/wishlist`          | Get my wishlist           |
| POST   | `/api/wishlist/:productId` | Add to wishlist         |
| DELETE | `/api/wishlist/:productId` | Remove from wishlist    |
| GET    | `/api/wishlist/check/:productId` | Check if in wishlist |

### Reviews
| Method | Endpoint                          | Description                    |
|--------|-----------------------------------|--------------------------------|
| GET    | `/api/reviews/product/:productId` | Get reviews for a product      |
| GET    | `/api/reviews/product/:productId/summary` | Rating summary          |
| POST   | `/api/reviews`                    | Add a review (auth, 1 per user)|
| DELETE | `/api/reviews/:id`                | Delete own review              |

### Addresses
| Method | Endpoint                    | Description              |
|--------|-----------------------------|--------------------------|
| GET    | `/api/addresses`            | Get my addresses         |
| POST   | `/api/addresses`            | Add an address           |
| PUT    | `/api/addresses/:id`        | Update an address        |
| DELETE | `/api/addresses/:id`        | Delete an address        |
| PUT    | `/api/addresses/:id/default`| Set default address      |

### Categories
| Method | Endpoint              | Description                |
|--------|-----------------------|----------------------------|
| GET    | `/api/categories`     | List categories            |
| POST   | `/api/categories`     | Create category (admin)    |
| PUT    | `/api/categories/:id` | Update category (admin)    |
| DELETE | `/api/categories/:id` | Delete category (admin)    |

### Admin
| Method | Endpoint                     | Description                    |
|--------|------------------------------|--------------------------------|
| GET    | `/api/admin/stats`           | Sales, orders, customers stats |
| GET    | `/api/admin/revenue-trend`   | Revenue trend (last 7 days)    |
| GET    | `/api/admin/top-products`    | Top selling products           |
| GET    | `/api/admin/recent-orders`   | Recent orders                  |
| GET    | `/api/admin/inventory-report`| Low-stock & inventory report   |
| GET    | `/api/admin/users`           | Customer list                  |
| GET    | `/api/admin/category-report` | Sales by category              |

## 🖼️ Uploading Saree Photos

1. Log in with the admin account
2. Click **Admin** in the navigation
3. Fill in the product details (name, price, fabric, color)
4. Choose a photo from your device and click **Add Product**

## 🛠️ Production Build

```bash
cd client
npm run build
```

The frontend will be built into `client/dist/`.

## 🧪 Running Tests / Smoke Test

A quick API smoke test script is included at `test-api.js`:

```bash
node test-api.js
```

## 📄 License

MIT — free to use and modify.