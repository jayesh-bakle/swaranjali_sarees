# SareeElegance (shoppingCart) — Full E-Commerce Audit & Repair Plan

## Context

`shoppingCart/` is a React (Vite) + Express + SQLite (local or Turso) saree store with JWT auth, Razorpay, Cloudinary, and a customer + admin dashboard. The user asked for a thorough review: **which must-have e-commerce features are missing, which edge cases are unhandled, and which glitches in the existing functionality could be repaired.**

This file is the complete audit (answer to the question) **and** the prioritized repair plan. Findings are grouped by severity; every item cites `file:line`. All paths are relative to `shoppingCart/`.

---

## Part 1 — Critical bugs (money / security) — repair first

1. **Free / underpriced orders — server trusts the client for every price.**
   - `server/routes/orders.js:40-58` — `total` and `items[].price` come from `req.body`, validated only as `total > 0`, stored verbatim. A user can edit `localStorage` cart prices or POST arbitrary values.
   - `server/routes/orders.js:47-49` — **any** `payment_method !== 'cod'` → `payment_status = 'paid'` with zero verification.
   - `server/routes/orders.js:77-88` — non-COD orders insert a `payments` row with a self-generated `TXN-...` id when no `razorpay_payment_id` is supplied. **A caller can mark any order "paid" for free.**
   - **Fix:** server recomputes each line price and the total from the DB (`products.price`/`sale_price`) instead of trusting the payload; whitelist `payment_method` to `cod|cash|razorpay`; only set `paid` when a verified Razorpay payment exists for that exact order (or via webhook).

2. **Razorpay amount spoofing — pay ₹1, mark a ₹50,000 order paid.**
   - `server/routes/payments.js:27-31` — `create-order` accepts an arbitrary client `amount`, decoupled from any order.
   - `server/routes/payments.js:112-166` — `/verify` never cross-checks the Razorpay order amount against the order total; it just verifies the signature pair and marks the passed `orderId` paid.
   - **Fix:** bind payment to the order — persist `razorpay_order_id` + amount at creation, and on `/verify` (and webhook) require `paid amount === order.total`.

3. **Payment-then-order is not atomic — customer charged, order lost.**
   - `client/src/pages/Checkout.jsx:153-181` — pays via Razorpay, then calls `placeOrder()`. If order creation fails (stock changed, validation), money is captured with **no order and no refund path**.
   - **Fix:** create the order (status `pending`) *first*, then open Razorpay against that order id; verification marks it paid. Any captured-but-unordered payment should trigger a Razorpay refund.

4. **Webhook signature check is broken in production.**
   - `server/routes/payments.js:183-186` — HMAC is computed over `JSON.stringify(req.body)`, but Razorpay signs the **raw body**. Key order/whitespace differences reject every legitimate event.
   - **Fix:** mount `express.raw()` (or `express.json({ verify })`) for the webhook route and sign the raw string. Also verify the webhook amount matches the order.

5. **Forgeable admin JWTs.**
   - `server/middleware/auth.js:6` — `JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me-in-production'`. If the env var is unset, anyone can mint an admin token.
   - **Fix:** hard-fail on startup (or on verify) when `JWT_SECRET` is unset; use the documented `CORS_ORIGINS` in `server.js:26` instead of `cors()` wide open.

6. **No rate limiting anywhere** — login/register are brute-forceable; order/product endpoints are spam/DoS-able (`server/server.js:26-28`, `server/routes/auth.js`). Add `express-rate-limit` (e.g. 5/min on login, 100/min on order creation). Optionally add `helmet`.

7. **Stored XSS / arbitrary-content hosting via uploads (local mode).**
   - `server/routes/products.js:48-55` — multer filters on **mimetype only** (client-controlled); `filename` keeps `path.extname(file.originalname)` (`products.js:40`), so a file named `evil.html` with `image/jpeg` mimetype is served from `/uploads` (`server.js:31`).
   - **Fix:** validate file magic bytes + force a whitelisted extension, or restrict uploads to Cloudinary-only in production.

## Part 2 — High-priority glitches (data integrity / stock)

8. **Oversell race + silent failed decrement.**
   - `server/routes/orders.js:102-106` — stock decrement `UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?` runs *after* the order INSERT and the `changes` count is **never checked**. Two concurrent orders can both pass the pre-check (`orders.js:114-122`); the losing decrement affects 0 rows and the order is still returned 201. No transactions anywhere (`BEGIN`/`COMMIT` absent in the whole server).
   - **Fix:** do the guarded `UPDATE ... WHERE stock >= ?` first and require `changes === 1` before creating the order; wrap order + stock + payment writes in a transaction (sqlite3 supports `BEGIN`/`COMMIT`; for Turso use batch).

9. **Negative / fractional / junk quantities corrupt stock.**
   - `server/routes/orders.js:102` — `item.quantity` is used directly. `quantity: -5` passes the `row.stock < item.quantity` check (`0 < -5` is false) and then **increases** stock (`stock - (-5)`). `quantity: 'abc'` → `NaN` → stock becomes `NULL`. Duplicate product ids in `items` are not merged, so two lines each pass the check and oversell.
   - **Fix:** validate `item.id` is a positive int, `item.quantity` is a positive integer with an upper cap; merge duplicate ids server-side before stock checks.

10. **"Refund" is cosmetic — no money returned.**
    - `server/routes/orders.js:228` — cancelling a paid order sets `payment_status = 'refunded'` but no Razorpay refund is issued.
    - **Fix:** call Razorpay `payments.refund()` for paid orders on cancel, or make refund an explicit admin action; never auto-mark refunded without a refund id.

11. **Status state machine has no guard rails.**
    - `server/routes/orders.js:246-301` — admin can move `cancelled → delivered`; stock was restored on cancel (`orders.js:277`) but is not re-decremented, so goods ship with restored inventory (free-inventory leak). Also `pending → delivered` directly is allowed.
    - **Fix:** validate transitions (cancelled is terminal; delivered requires shipped first; re-decrement stock if reviving a cancelled order).

12. **`JSON.parse` on stored JSON can crash the process.**
    - `server/routes/orders.js:23-26` (`formatOrder`) and `server/routes/admin.js:89` parse `orders.items`; `client/src/pages/TrackOrder.jsx:314` parses `payment.payment_details`. A corrupt/legacy row throws synchronously inside a callback → 500/crash.
    - **Fix:** wrap in try/catch with a fallback value.

13. **Foreign keys are declared but never enforced.**
    - `server/db.js` — no `PRAGMA foreign_keys = ON` anywhere (local mode); Turso defaults FKs off. Result: `wishlist` rows for non-existent products are insertable (`server/routes/wishlist.js:26-37` has no product-existence check). Add the pragma (local) and product-existence checks.

14. **Fire-and-forget `db.run` errors can crash local sqlite mode.**
    - `server/routes/products.js:363-364` (wishlist/review cleanup), `server/routes/orders.js:12-20` (`addTracking`), `orders.js:85` — a run with no callback on an errored statement emits an unhandled `error` event on the sqlite3 object → process crash. Attach a global `db.on('error', ...)` handler and pass callbacks.

## Part 3 — Medium / UX glitches

15. **Admin "top products" report is a Cartesian product — every product shows total store revenue.**
    - `server/routes/admin.js:61-78` — `LEFT JOIN (...) o ON 1=1` with no `o.product_id = p.id` correlation, then `SUM(o.total)` per product. Every product reports identical (total) revenue.
    - **Fix:** correlate `json_each` rows to `p.id` (extract `id` from items, join on it).

16. **Home category links point to categories that don't exist.**
    - `client/src/pages/Home.jsx:102-104` links to `Traditional Paithani / Designer Paithani / Paithani Dupattas`; seeded categories are `Paithani Collection / Banarasi Collection / Kanjivaram Collection` (`server/db.js:15-19`). Every "Explore Paithani" card renders an empty shop.
    - **Fix:** point Home links to the real seeded category names (or `GET /api/categories`).

17. **Shop has no pagination UI** — server supports `page/limit` (`server/routes/products.js:138-141`, cap 100) but `Shop.jsx` always sends `limit:50` and never `page`; beyond 50 products are unreachable. Server also never returns a total count.

18. **Shop filter options are derived from the current page's products** (`Shop.jsx:38-43`) — circular/shrinking as you filter; should come from `GET /api/categories` / a facets endpoint.

19. **Out-of-stock products can be added to cart from cards & wishlist.**
    - `client/src/components/ProductCard.jsx:50-58` and `client/src/pages/Wishlist.jsx:45-48` have no `stock <= 0` guard (ProductDetail does, `ProductDetail.jsx:172`).

20. **Cart ADD_ITEM merge bypasses the stock clamp.**
    - `client/src/context/CartContext.jsx:11-19` — adding an existing item just sums quantities with no clamp to `item.stock`; `UPDATE_QUANTITY` clamps (line 30) but the merge path doesn't. Also `item.stock || 99` treats `stock:0` as "no cap" (`CartContext.jsx:30`), so a sold-out item can be bumped to qty 99.

21. **`.btn-secondary` is used but never defined** — `client/src/index.css` has no `.btn-secondary`, yet it's used at `Addresses.jsx:174`, `Checkout.jsx:303`, `Orders.jsx:269`. Those render as unstyled buttons.

22. **Login never returns you to the page you came from.**
    - `client/src/pages/Login.jsx:13` reads `location.state?.from`, but no caller passes it (`Cart.jsx:23`, Navbar, `Admin.jsx:215`). Users always land on `/` after login. Pass `state: { from: location.pathname }` at every gated navigation.

23. **Error states masquerade as empty states.**
    - `Home.jsx:22`, `Shop.jsx:45`, `ProductDetail.jsx:34`, `Wishlist.jsx:28`, `Checkout.jsx:47` only `console.error`, then render "No products / not found / empty wishlist" on a 500/network failure.

24. **Admin double-submit & race glitches.**
    - `Admin.jsx:119-147` product submit has no `submitting` guard (rapid clicks → duplicate products); stock `+/-` (`Admin.jsx:180-189`) and order status/payment selects fire overlapping PUTs with no busy state.

25. **Two parallel checkout implementations.**
    - `Cart.jsx:196-229` embeds its own inline COD-only checkout (→ `/success`); `Checkout.jsx` is the real one (→ `/track-order/:id`). Consolidate to one flow; the Cart inline path silently omits `payment_method` and payment handling.

26. **Silent 401 logout** — `client/src/api/client.js:20-24` clears the session with no toast/redirect; user just sees the navbar flip to "Sign In".

27. **Fake "Estimated delivery"** — `TrackOrder.jsx:212` hardcodes now + 3 days regardless of status; label it as an estimate or drive it from order data.

28. **Product create can't set 0 stock & accepts junk stock.**
    - `server/routes/products.js:247` — `parseInt(stock) || 10` turns `0` into `10`; `products.js:275-283` `parseInt(stock) < 0` lets `'abc'` pass (`NaN < 0` is false) → stock becomes `NULL`. Validate strictly; also `products.js:240` allows negative prices and `sale_price >= price`.

29. **`is_featured === 1` strict compares** (`ProductCard.jsx:35`, `ProductDetail.jsx:88`, `Admin.jsx:161`) — breaks if the server ever returns boolean `true`; standardize on a tolerant check like AuthContext's `isAdmin`.

30. **Wishlist POST doesn't verify product exists** (`server/routes/wishlist.js:26-37`) — with FKs off, orphan rows persist.

## Part 4 — Missing must-have e-commerce features (feature roadmap)

**Must-haves for a "basic" store that are genuinely absent or half-built:**

1. **Product reviews have no UI.** The whole backend exists (`server/routes/reviews.js`, schema in `db.js:103-114`, rating already rolled up in every product query) but **no product page renders reviews or a review form** — `ProductDetail.jsx` ends at "Related products". Customers cannot see or leave ratings. Highest-value missing feature. *(Also: reviews don't verify the reviewer purchased the item — `reviews.js:51-53`.)*
2. **Order confirmation / status emails** — no mailer anywhere (grep confirms). A store needs order-confirmation, shipped, and delivered emails.
3. **Pagination on the Shop page** (server-side support exists; UI missing — see #17).
4. **Guest browsing/checkout** — the entire app (even the cart) is login-gated (`Cart.jsx:51-58`, `Checkout.jsx:51-58`). Standard stores let guests browse and checkout with email capture.
5. **Coupon / discount codes** — only per-product `sale_price` exists; no promo engine.
6. **Shipping cost & tax calculation** — shipping is hardcoded "FREE" (`Cart.jsx:174`, `Checkout.jsx:418`, `TrackOrder.jsx:366`); no tax.
7. **Product variants** — a single `size`/`color` TEXT per product (`db.js:73-74`); no size/color SKU model, no per-variant stock/price. (Relevant for a saree store that may offer blouse/length options.)
8. **Multiple product images / gallery** — only one `image_url` column.
9. **Global search in the Navbar** — search only lives on `/shop`.
10. **Returns / refund request flow** — cancel exists but no return/refund-request lifecycle for delivered items.
11. **"Buy again" / reorder** on order history.
12. **Forgot-password / password reset & email verification** — no recovery path.
13. **Admin polish:** pagination on orders/users lists, CSV/Excel export, search inside admin, per-order timeline view, low-stock notification.
14. **SEO/meta & 404 handling** — no route-level `<title>`/meta, no catch-all 404 route (unknown paths render blank in `App.jsx`), no error boundary.

## Part 5 — Recommended implementation order

**Phase A — Critical security/money fixes (Parts 1–2, items 1–14):**
- Server-side price recompute + `payment_method` whitelist in `orders.js`
- Payment binding & amount cross-check in `payments.js` (`create-order`/`verify`/`webhook`); raw-body webhook signature
- Order-first, then-pay checkout flow (order `pending` → verify → `paid`)
- `JWT_SECRET` hard-fail; rate limiting; upload hardening; stock transaction + quantity validation; refund API call; status state machine; JSON.parse guards; FK pragma

**Phase B — Frontend correctness (Part 3):**
- Fix `top-products` query, Home category links, Shop pagination + facet source, out-of-stock guards, cart clamp, `.btn-secondary`, login `state.from`, error-vs-empty states, admin busy states, single checkout flow, 401 toast, estimated delivery, product stock validation

**Phase C — Feature roadmap (Part 4):**
- Reviews UI (display + form on ProductDetail) — highest-value
- Order emails, Shop pagination, guest checkout, coupons, shipping/tax, variants, image gallery, navbar search, returns, password reset, admin exports, SEO/404

## Part 6 — Verification

- `cd server && npm run dev` + `cd client && npm run dev`, then:
  - **Security:** attempt `POST /api/orders` with `payment_method:'razorpay'` and no payment_details → must be rejected; attempt tampered `total` → server rejects with computed total; `/verify` with mismatched amount → rejected; forged JWT with default secret after removal → 401.
  - **Stock:** place two concurrent orders for the last unit → only one succeeds; `quantity:-5` / `'abc'` / duplicate id → rejected.
  - **Reports:** admin Top Products now shows per-product revenue that correlates with order items.
  - **Reviews UI:** leave a rating on a product, see it render with the average.
  - **Shop:** pagination moves past 50 products; Home category cards return products.
  - `node test-api.js` smoke test still passes.
