/**
 * Seeds sample data on top of the catalog from supabase/seed.sql:
 *   - the store owner's admin account (SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD);
 *   - a sample customer (no password, cannot sign in) with one order in each
 *     lifecycle state, so the admin area has something to show.
 *
 *   npm run seed
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_OWNER_*
 * from .env.local. Users are created through the Supabase Admin API so passwords
 * are hashed by Supabase Auth; orders go through the same SQL functions the app
 * uses. Safe to re-run.
 */
import { createClient } from "@supabase/supabase-js";

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}. Set it in .env.local (see .env.example).`);
    process.exit(1);
  }
  return value;
}

const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Role = "admin" | "customer";

async function findUserId(email: string): Promise<string | null> {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function upsertUser(email: string, password: string | undefined, fullName: string, role: Role): Promise<string> {
  let id = await findUserId(email);
  if (id) {
    if (password) {
      const { error } = await supabase.auth.admin.updateUserById(id, { password, email_confirm: true });
      if (error) throw error;
    }
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    id = data.user.id;
  }

  // Role changes are only possible with the service role (customers cannot update `role`).
  const { error } = await supabase
    .from("profiles")
    .update({ role, full_name: fullName, welcome_email_sent_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;

  console.log(`✓ ${role.padEnd(8)} ${email}`);
  return id;
}

type Status = "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled";
const FULFILMENT: Status[] = ["processing", "shipped", "delivered"];

/** Creates an order and walks it through the lifecycle up to `status`, as the app and webhook would. */
async function sampleOrder(
  userId: string,
  email: string,
  items: Record<string, number>,
  status: Status,
  daysAgo: number,
) {
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, slug")
    .in("slug", Object.keys(items));
  if (productsError) throw productsError;
  if (products.length !== Object.keys(items).length) {
    throw new Error("Sample products are missing. Run `npm run db:reset` (or seed supabase/seed.sql) first.");
  }

  const { data: orderId, error } = await supabase.rpc("create_order", {
    p_user_id: userId,
    p_customer_email: email,
    p_items: products.map((p) => ({ product_id: p.id, quantity: items[p.slug] })),
  });
  if (error) throw error;

  if (status === "cancelled") {
    const { error: releaseError } = await supabase.rpc("release_pending_order", { p_order_id: orderId });
    if (releaseError) throw releaseError;
  } else if (status !== "pending") {
    const { data: order, error: loadError } = await supabase
      .from("orders")
      .select("total_cents")
      .eq("id", orderId)
      .single();
    if (loadError) throw loadError;
    const ref = orderId.replaceAll("-", "");
    const { error: payError } = await supabase.rpc("apply_checkout_event", {
      p_event_id: `evt_seed_${ref}`,
      p_event_type: "checkout.session.completed",
      p_order_id: orderId,
      p_session_id: `cs_seed_${ref}`,
      p_payment_intent_id: `pi_seed_${ref}`,
      p_amount_total: order.total_cents,
      p_currency: "usd",
      p_outcome: "paid",
    });
    if (payError) throw payError;
    // The status guard only allows one step at a time.
    for (const next of FULFILMENT.slice(0, FULFILMENT.indexOf(status) + 1)) {
      const { error: statusError } = await supabase.from("orders").update({ status: next }).eq("id", orderId);
      if (statusError) throw statusError;
    }
  }

  const at = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  const paid = status !== "pending" && status !== "cancelled";
  const { error: dateError } = await supabase
    .from("orders")
    .update({ created_at: at, ...(paid && { paid_at: at, confirmation_email_sent_at: at }) })
    .eq("id", orderId);
  if (dateError) throw dateError;
}

await upsertUser(env("SEED_OWNER_EMAIL"), env("SEED_OWNER_PASSWORD"), "Store Owner", "admin");

const customerEmail = "sample.customer@deskcraft.test";
const customerId = await upsertUser(customerEmail, undefined, "Sam Sample", "customer");

const { count, error: countError } = await supabase
  .from("orders")
  .select("id", { count: "exact", head: true })
  .eq("user_id", customerId);
if (countError) throw countError;

if (count) {
  console.log("Sample orders already exist; nothing to do.");
} else {
  await sampleOrder(
    customerId,
    customerEmail,
    { "arc75-wireless-mechanical-keyboard": 1, "vector-pro-wireless-gaming-mouse": 1 },
    "delivered",
    24,
  );
  await sampleOrder(customerId, customerEmail, { "glide-ergonomic-wireless-mouse": 1 }, "cancelled", 12);
  await sampleOrder(customerId, customerEmail, { "pulse-anc-wireless-headphones": 1 }, "shipped", 9);
  await sampleOrder(
    customerId,
    customerEmail,
    { "vista-27-4k-ips-monitor": 1, "nexus-8-in-1-usb-c-hub": 1 },
    "processing",
    4,
  );
  await sampleOrder(
    customerId,
    customerEmail,
    { "echo-usb-condenser-microphone": 1, "bolt-2tb-nvme-ssd": 2 },
    "paid",
    1,
  );
  await sampleOrder(customerId, customerEmail, { "clarity-4k-streaming-webcam": 1 }, "pending", 0);
  console.log("✓ 6 sample orders");
}
