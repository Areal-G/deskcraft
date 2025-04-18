# Deskcraft

Desk-setup store with accounts, Stripe Checkout, order tracking and an admin area. Built on Next.js 16.3, React 19.2, TypeScript, Supabase and Stripe. Pricing, stock, payment state and access are enforced in PostgreSQL, not only in the UI.

All products, prices and accounts are fictional. Prices are in USD.

## Setup

1. Install Node.js 20.9+ and Docker (for local Supabase). A Stripe test account and the Stripe CLI are optional.
2. `npm install`
3. `npx supabase start` (API on 56521, Studio on 56523, auth email inbox on 56524)
4. `npm run db:reset` to apply the migrations and seed the catalog
5. `cp .env.example .env.local` and fill it in (see Environment below)
6. `npm run seed:users` to create the demo admin and customer
7. `docker exec -i supabase_db_deskcraft psql -U postgres -d postgres < scripts/seed-demo-orders.sql` for the demo order history
8. `npx next dev -p 4107` and open http://localhost:4107

## What's here

* catalog of 12 products in 6 categories, with search, category filters and sorting
* product pages with live stock status; sold-out products can't go in the cart
* cart in `localStorage`, capped by stock and a per-item maximum
* accounts: sign up with email confirmation, sign in, sign out, password reset
* order history and order tracking with a lifecycle timeline
* Stripe Checkout with a signature-verified webhook
* admin dashboard, product editing, inline stock, order status changes
* transactional emails through Resend (logged to the console without a key)

## Database

Everything important is in Postgres. Tables:

* **categories**
  * 6 rows from `supabase/seed.sql`
  * used by the catalog filters and the home page
* **products**
  * `id`
  * `slug`
  * name
  * price
  * category
  * image URL (checked against an allowlist)
  * `stock_quantity`
  * active flag (admins can toggle it)
* **orders**
  * owner (the customer)
  * `status`
  * `payment_status`
  * total (currently equal to the subtotal, no tax or shipping)
  * confirmation email flag (claimed with a conditional update so it's sent once)
* **order items**
  * `product_id`
  * quantity
  * product name snapshot
  * unit price snapshot
* **profiles**
  * one per user
  * role (`admin` or not)
* **webhook event ledger**
  * Stripe event id
  * written in the same transaction as the order update

Functions and triggers:

* `create_order()` — one transaction, locks product rows in a fixed order, checks stock, decrements it, inserts the order with price snapshots, max 3 pending orders per hour per customer
* `apply_checkout_event()` — records the event id, checks amount and currency, moves the order `pending → paid` or cancels it
* `guard_order_status_change()` — `before update` trigger that rejects illegal transitions
* restock trigger — puts stock back when an order is cancelled

RLS is on every table.

## Order statuses

An order is created as `pending`. When the webhook confirms payment it becomes `paid`. An admin can then move it to `processing`, then `shipped`, then `delivered`. It can be `cancelled` while it is `pending`, `paid` or `processing`. It can't be cancelled after `shipped`. Cancelling gives the stock back.

## Order lifecycle

* `pending` — order created, stock reserved, waiting for Stripe
* `paid` — webhook confirmed the payment
* `processing` — admin is preparing it
* `shipped` — on its way, can no longer be cancelled
* `delivered` — done
* `cancelled` — allowed before shipping; stock is restored

`paid`, `processing`, `shipped` and `delivered` all require `payment_status` to be `paid`, otherwise the trigger raises `ORDER_NOT_PAID`. Anything else raises `INVALID_STATUS_TRANSITION`.

## Stripe

Put a test-mode secret key in `STRIPE_SECRET_KEY`, then forward the four handled events:

```bash
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to localhost:4107/api/webhooks/stripe
```

Copy the `whsec_…` into `STRIPE_WEBHOOK_SECRET` and restart. Test card `4242 4242 4242 4242`.

## Demo accounts

`customer@deskcraft.test` and `admin@deskcraft.test`, passwords from `.env.example`. The customer has six demo orders, one per state.

## Environment

You need `NEXT_PUBLIC_SITE_URL`, which is the base URL used for Stripe redirects and email links and is baked in at build time, and `NEXT_PUBLIC_SUPABASE_URL`, which is the Supabase API URL, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, which is the public anon key and is safe because of RLS, and `SUPABASE_SERVICE_ROLE_KEY`, which is server only and bypasses RLS so it must never reach the browser. For checkout you need `STRIPE_SECRET_KEY` with a test-mode key, and for webhooks you need `STRIPE_WEBHOOK_SECRET`, which is either the endpoint signing secret or the one printed by `stripe listen`. `RESEND_API_KEY` is optional and without it emails are logged instead of sent, and `EMAIL_FROM` is the sender address where `onboarding@resend.dev` works for testing. Finally `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD`, `DEMO_CUSTOMER_EMAIL` and `DEMO_CUSTOMER_PASSWORD` are only used locally by `npm run seed:users`.

## Tests

* `npm test` — Vitest
* `npm run test:db` — pgTAP
* `npm run test:e2e` — Playwright
* `npm run typecheck`, `npm run lint`

Integration, database and E2E tests need the local Supabase stack running.

## TODO

* shipping addresses, tax, shipping costs
* refunds (`refunded` status exists, nothing sets it)
* server-side cart
* image uploads in admin