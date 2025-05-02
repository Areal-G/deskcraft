# Deskcraft

A full-stack desk-setup store: accounts, Stripe Checkout, order tracking and an admin area. Pricing, stock, payment state and access are enforced in PostgreSQL, so they hold no matter which code path touches the data.

## About

Customers browse a catalog, build a cart, create an account and pay through Stripe Checkout. Payment is confirmed asynchronously by a signature-verified Stripe webhook, which is the only thing that can mark an order as paid. Admins manage products, stock and fulfilment from a protected admin area.

Most of the work went into the parts of a store that are easy to get wrong:

* **Access.** Row Level Security on every table decides who can read or change what. The UI is not the only guard.
* **Price.** What a customer pays always comes from the database. A price sent from the browser is stripped.
* **Payment.** An order is paid only when a verified webhook says so, and each event is processed exactly once.
* **Stock.** It can't be oversold, and abandoned checkouts give it back.

What the store has:

* 12 products in 6 categories, with search, category filters, sorting and live stock status
* a cart in `localStorage` that keeps only product ids and quantities, capped by stock
* sign up with email confirmation, sign in, password recovery, profile and order history
* order tracking with a lifecycle timeline, limited to the customer's own orders
* an admin dashboard with revenue from paid orders, the fulfilment queue, orders awaiting payment and low stock
* product create/edit, an active toggle and inline stock in admin
* transactional email through Resend: confirmation, payment failed, status updates, welcome

Hardening on top of that: safe same-origin redirects for `?next=`, HTML-escaped email templates, an allowlist for product image URLs, and security headers (`X-Frame-Options`, HSTS, `Referrer-Policy`, `Permissions-Policy`).

All products, prices and accounts are fictional. Prices are in USD.

## Accounts

`npm run seed:users` creates two demo accounts:

| Role | Email | Password | Can do |
| --- | --- | --- | --- |
| Customer | `customer@deskcraft.test` | `DEMO_CUSTOMER_PASSWORD` in `.env.example` | Shop, pay, see own orders |
| Admin | `admin@deskcraft.test` | `DEMO_ADMIN_PASSWORD` in `.env.example` | Manage products, stock and order status |

The customer gets six demo orders, one in each lifecycle state, from `scripts/seed-demo-orders.sql`.

In admin, orders can be filtered by status and moved along the lifecycle. The customer gets an email on each change.

Admin access is checked in three places: page guards, `assertAdmin()` in every admin Server Action, and RLS. Admins can update only an order's `status` column, never its money fields.

## Checkout flow

```
cart → startCheckout → create_order() → Stripe Checkout → webhook → paid
```

1. `startCheckout` requires a signed-in user and validates the cart with Zod. Unknown fields, such as a price, are dropped.
2. `create_order()` runs as one transaction. It caps a customer at 3 pending orders per hour, locks product rows in a fixed order, checks each one is active and in stock, decrements stock and stores the order with price snapshots.
3. A Checkout Session is built from the stored order, with a 30-minute expiry and a per-order idempotency key. If anything fails, the session is expired and the stock released.
4. The webhook verifies the signature on the raw body and calls `apply_checkout_event()`. That records the event id, checks amount and currency, and moves the order `pending → paid`, or cancels and restocks on failure or expiry. A duplicate event does nothing.
5. On a fresh `paid` transition the confirmation email is claimed with a conditional update, so it goes out at most once.

The success page only shows what the webhook wrote. Landing on it confirms nothing.

After payment, the lifecycle is enforced by a database trigger:

```
pending → paid → processing → shipped → delivered
```

`cancelled` is allowed before shipping, and cancelling puts the stock back. Any other transition is rejected, whoever runs the query. The guard is a `before update` trigger:

```sql
create or replace function public.guard_order_status_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status in ('paid', 'processing', 'shipped', 'delivered') and new.payment_status <> 'paid' then
    raise exception 'ORDER_NOT_PAID' using errcode = 'check_violation';
  end if;

  if not (
       (old.status = 'pending'    and new.status in ('paid', 'cancelled'))
    or (old.status = 'paid'       and new.status in ('processing', 'shipped', 'cancelled'))
    or (old.status = 'processing' and new.status in ('shipped', 'cancelled'))
    or (old.status = 'shipped'    and new.status = 'delivered')
  ) then
    raise exception 'INVALID_STATUS_TRANSITION' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
```

Orders keep snapshots of product name and unit price, so a later price change never alters a past order.

Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

## Stack

| Layer | Tech |
| --- | --- |
| App | Next.js 16.3 (App Router, Server Actions), React 19.2, TypeScript 5 |
| UI | Tailwind CSS 4, shadcn/ui on Radix UI, lucide-react, sonner |
| Data | Supabase Auth + PostgreSQL, `@supabase/ssr`, `@supabase/supabase-js` |
| Payments | Stripe Checkout + webhooks |
| Email | Resend |
| Validation | Zod 4 |
| Tests | Vitest, pgTAP, Playwright |

There are two Supabase clients on purpose. Everything a user does, admins included, goes through the request-scoped client with the user's session, so RLS always applies. The service-role client is server only and is used for creating orders, applying webhook events and email bookkeeping.

Layout:

```
src/
  app/
    api/webhooks/stripe/   webhook: signature check, idempotent processing
    account/               profile, order history, order tracking
    admin/                 dashboard, products, orders
  lib/
    auth/ admin/ checkout/ Server Actions and queries
    cart/                  cart logic shared by client and server
    stripe/                client, Checkout Session builder, webhook processor
    email/                 Resend sender and templates
    supabase/              server, service-role and proxy clients
  proxy.ts                 session refresh and protected-route redirects
supabase/
  migrations/              schema, RLS, SQL functions and triggers
  seed.sql                 6 categories and 12 products
  tests/database/          pgTAP tests
scripts/                   demo users and demo order history
```

## Local development

You need Node.js 20.9+, npm and Docker. Stripe test mode and the Stripe CLI are optional.

```bash
git clone <repository-url> deskcraft
cd deskcraft
npm install
```

Start Supabase. The API runs on 56521, Studio on 56523 and the auth email inbox on 56524.

```bash
npx supabase start
npm run db:reset
```

Fill in `.env.local` with the values from `npx supabase status`:

```bash
cp .env.example .env.local
```

Seed the demo accounts and their orders:

```bash
npm run seed:users
docker exec -i supabase_db_deskcraft psql -U postgres -d postgres < scripts/seed-demo-orders.sql
```

Run on the port the auth redirects expect:

```bash
npx next dev -p 4107
```

Open http://localhost:4107.

**Stripe.** Put a test-mode key in `STRIPE_SECRET_KEY`, then forward the handled events:

```bash
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to localhost:4107/api/webhooks/stripe
```

Copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET` and restart the dev server. Without Stripe keys, everything except paying works.

Scripts:

| Script | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Route types, then `tsc --noEmit` |
| `npm run db:reset` | Rebuild the local database from migrations and seed |
| `npm run db:types` | Regenerate `src/lib/types/database.ts` |
| `npm run seed:users` | Create the demo admin and customer |
| `npm run format` | Prettier |

## Environment

| Variable | Needed | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | yes | Base URL for Stripe redirects and email links |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public anon key, protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server only, bypasses RLS |
| `STRIPE_SECRET_KEY` | checkout | Test-mode secret key |
| `STRIPE_WEBHOOK_SECRET` | webhooks | From the endpoint or `stripe listen` |
| `RESEND_API_KEY` | no | Without it, emails are logged |
| `EMAIL_FROM` | no | Sender address |

`DEMO_*` variables are only used by `npm run seed:users`.

`NEXT_PUBLIC_SITE_URL` is baked in at build time, so redeploy after changing any `NEXT_PUBLIC_*` value. In production, point the Stripe webhook endpoint at `https://<your-domain>/api/webhooks/stripe` for the four `checkout.session.*` events. Without `RESEND_API_KEY`, emails are only written to the server console.

## Tests

| Command | What it covers |
| --- | --- |
| `npm test` | Vitest, 83 tests: cart maths, tampered carts, Zod schemas, webhook mapping and idempotency, signature checks, email escaping |
| `npm run test:db` | pgTAP, 27 tests: RLS per role, no self-promotion to admin, stock and pending-order limits, no shipping unpaid orders |
| `npm run test:e2e` | Playwright on desktop and mobile: catalog, cart, sign-up, protected routes, admin flows, a forged success page |
| `npm run typecheck`, `npm run lint` | TypeScript and ESLint |

Integration, database and E2E tests need the local Supabase stack. Playwright starts its own server on port 3000 by default (`E2E_PORT` overrides it), and auth email links follow `NEXT_PUBLIC_SITE_URL`.

The database tests are the important ones here: the rules live in Postgres, so they are tested in Postgres. One pgTAP test currently fails because it looks for a product slug that is no longer in the seed.