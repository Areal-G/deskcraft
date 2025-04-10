# Deskcraft

Desk-setup store. Next.js on the front, Supabase (Postgres + Auth) behind it, Stripe Checkout for payment.

## Setup

1. Install Node.js 20.9+ and Docker.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the local Supabase stack and load the schema + seed:

   ```bash
   npx supabase start
   npm run db:reset
   ```

4. Copy the env template and paste in the URL and keys from `npx supabase status`:

   ```bash
   cp .env.example .env.local
   ```

5. Run it on port 4107 (the auth redirects expect that port):

   ```bash
   npx next dev -p 4107
   ```

Stripe is optional for now. Without `STRIPE_SECRET_KEY` everything works except paying.

## What's here

* catalog with categories and stock status
* cart in `localStorage` (product ids + quantities only)
* sign up / sign in / sign out via Supabase Auth
* Stripe Checkout, order marked paid by the webhook only
* admin area for products and orders (WIP)

Prices and stock rules are meant to live in Postgres, not the UI. All products are fictional.