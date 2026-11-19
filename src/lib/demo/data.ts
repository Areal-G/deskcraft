import type { Database } from "@/lib/types/database";

type Tables = Database["public"]["Tables"];
export type CategoryRow = Tables["categories"]["Row"];
export type ProductRow = Tables["products"]["Row"];
export type ProfileRow = Tables["profiles"]["Row"];
export type OrderRow = Tables["orders"]["Row"];
export type OrderItemRow = Tables["order_items"]["Row"];
export type DemoRole = ProfileRow["role"];

/** Stable ids, so orders kept in a visitor's cookie still resolve after a cold start. */
const uuid = (group: number, n: number) => `00000000-0000-4000-8000-${String(group * 1000 + n).padStart(12, "0")}`;

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export const DEMO_USERS: Record<DemoRole, { id: string; email: string; fullName: string }> = {
  customer: { id: uuid(1, 1), email: "customer@deskcraft.test", fullName: "Casey Customer" },
  admin: { id: uuid(1, 2), email: "admin@deskcraft.test", fullName: "Ada Admin" },
};

const CATEGORIES: [slug: string, name: string, description: string][] = [
  ["keyboards", "Keyboards", "Mechanical and low-profile keyboards tuned for typing and play."],
  ["mice", "Mice", "Precise sensors, light shells and all-day ergonomics."],
  ["audio", "Audio", "Headphones and microphones for focus, calls and creating."],
  ["monitors", "Monitors", "Sharp, fast displays for work and play."],
  ["accessories", "Accessories", "Hubs, cameras and controllers that complete the setup."],
  ["storage", "Storage", "Fast, reliable storage for your system and projects."],
];

type ProductSeed = [category: string, name: string, slug: string, cents: number, stock: number, featured: boolean];

// Mirrors supabase/seed.sql.
const PRODUCTS: [...ProductSeed, description: string][] = [
  [
    "keyboards",
    "Arc75 Wireless Mechanical Keyboard",
    "arc75-wireless-mechanical-keyboard",
    14900,
    24,
    true,
    "A 75% gasket-mounted keyboard with hot-swappable switches, PBT double-shot keycaps and tri-mode connectivity (USB-C, 2.4 GHz and Bluetooth 5.3). The 4,000 mAh battery lasts up to 200 hours with backlight off.",
  ],
  [
    "keyboards",
    "Ember 65 Hot-Swap Keyboard",
    "ember-65-hot-swap-keyboard",
    11900,
    12,
    false,
    "Compact 65% layout with an aluminium top case, pre-lubed linear switches and a silicone dampening stack for a deep, quiet sound. Wired USB-C with a detachable braided cable.",
  ],
  [
    "mice",
    "Vector Pro Wireless Gaming Mouse",
    "vector-pro-wireless-gaming-mouse",
    12900,
    18,
    true,
    "A 58 g ultralight shell with a 26K DPI optical sensor, optical switches rated for 90 million clicks and 1 ms 2.4 GHz wireless. PTFE feet and up to 80 hours per charge.",
  ],
  [
    "mice",
    "Glide Ergonomic Wireless Mouse",
    "glide-ergonomic-wireless-mouse",
    4900,
    55,
    false,
    "Sculpted right-handed shape with a soft-touch finish, silent clicks and a hyper-fast scroll wheel. Connects over Bluetooth or the included USB-C receiver.",
  ],
  [
    "audio",
    "Pulse ANC Wireless Headphones",
    "pulse-anc-wireless-headphones",
    29900,
    9,
    true,
    "Hybrid active noise cancelling, 40 mm dynamic drivers and up to 45 hours of playback. Multipoint Bluetooth 5.3 keeps your laptop and phone connected at the same time.",
  ],
  [
    "audio",
    "Reference Studio Headphones",
    "reference-studio-headphones",
    17900,
    0,
    false,
    "Closed-back studio headphones with a flat, honest frequency response for mixing and editing. Swivelling ear cups, replaceable velour pads and a detachable 3 m cable.",
  ],
  [
    "audio",
    "Echo USB Condenser Microphone",
    "echo-usb-condenser-microphone",
    12900,
    16,
    true,
    "Cardioid condenser microphone with 24-bit/96 kHz USB-C output, zero-latency headphone monitoring and a tap-to-mute capacitive sensor. Ships with a desk boom arm and pop filter.",
  ],
  [
    "monitors",
    'Vista 27" 4K IPS Monitor',
    "vista-27-4k-ips-monitor",
    44900,
    7,
    true,
    "27-inch 4K IPS panel covering 98% DCI-P3, factory-calibrated to ΔE < 2. USB-C with 90 W power delivery turns it into a single-cable laptop dock.",
  ],
  [
    "monitors",
    'Horizon 34" Ultrawide 165 Hz',
    "horizon-34-ultrawide-165hz",
    79900,
    4,
    false,
    "34-inch 1500R curved WQHD display with a 165 Hz refresh rate, 1 ms response time and adaptive sync. A height-adjustable stand and VESA mount are included.",
  ],
  [
    "accessories",
    "Nexus 8-in-1 USB-C Hub",
    "nexus-8-in-1-usb-c-hub",
    5900,
    60,
    false,
    "Aluminium hub with 4K60 HDMI, 100 W pass-through charging, gigabit Ethernet, SD and microSD readers plus two 10 Gbps USB-A ports. Fits in any laptop sleeve.",
  ],
  [
    "accessories",
    "Clarity 4K Streaming Webcam",
    "clarity-4k-streaming-webcam",
    13900,
    11,
    false,
    '4K30 / 1080p60 webcam with a large 1/2.8" sensor, auto light correction and dual noise-reducing microphones. Includes a privacy shutter and a universal mount.',
  ],
  [
    "storage",
    "Bolt 2TB NVMe SSD",
    "bolt-2tb-nvme-ssd",
    15900,
    30,
    false,
    "PCIe 4.0 NVMe M.2 2280 drive with sequential reads up to 7,300 MB/s and a graphene heat spreader. Backed by a five-year limited warranty.",
  ],
];

// The demo customer's history: one order in each lifecycle state.
const ORDERS: [items: Record<string, number>, status: OrderRow["status"], daysAgo: number][] = [
  [{ "arc75-wireless-mechanical-keyboard": 1, "vector-pro-wireless-gaming-mouse": 1 }, "delivered", 24],
  [{ "glide-ergonomic-wireless-mouse": 1 }, "cancelled", 12],
  [{ "pulse-anc-wireless-headphones": 1 }, "shipped", 9],
  [{ "vista-27-4k-ips-monitor": 1, "nexus-8-in-1-usb-c-hub": 1 }, "processing", 4],
  [{ "echo-usb-condenser-microphone": 1, "bolt-2tb-nvme-ssd": 2 }, "paid", 1],
  [{ "clarity-4k-streaming-webcam": 1 }, "pending", 0],
];

export type DemoData = {
  categories: CategoryRow[];
  products: ProductRow[];
  profiles: ProfileRow[];
  orders: OrderRow[];
  orderItems: OrderItemRow[];
};

export function buildOrderItem(
  orderId: string,
  product: ProductRow,
  quantity: number,
  createdAt: string,
): OrderItemRow {
  return {
    id: crypto.randomUUID(),
    order_id: orderId,
    product_id: product.id,
    product_name: product.name,
    product_image_url: product.image_url,
    unit_price_cents: product.price_cents,
    quantity,
    subtotal_cents: product.price_cents * quantity,
    created_at: createdAt,
  };
}

export function buildOrder(
  fields: Pick<OrderRow, "id" | "order_number" | "user_id" | "customer_email" | "status" | "created_at">,
  items: OrderItemRow[],
): OrderRow {
  const total = items.reduce((sum, i) => sum + i.subtotal_cents, 0);
  const paid = !["pending", "cancelled"].includes(fields.status);
  return {
    ...fields,
    payment_status: paid ? "paid" : fields.status === "cancelled" ? "failed" : "pending",
    currency: "usd",
    subtotal_cents: total,
    total_cents: total,
    stripe_checkout_session_id: checkoutRef(fields.id),
    stripe_payment_intent_id: null,
    paid_at: paid ? fields.created_at : null,
    confirmation_email_sent_at: paid ? fields.created_at : null,
    updated_at: fields.created_at,
  };
}

/** The demo's stand-in for a Checkout Session id, derived from the order id. */
export function checkoutRef(orderId: string): string {
  return `cs_test_demo${orderId.replaceAll("-", "")}`;
}

/** Builds a fresh copy of the sample data. Pure and synchronous, so seeding cannot race. */
export function createDemoData(): DemoData {
  const created = daysAgo(60);
  const categories = CATEGORIES.map(([slug, name, description], i) => ({
    id: uuid(2, i + 1),
    slug,
    name,
    description,
    sort_order: i + 1,
    created_at: created,
  }));

  const products = PRODUCTS.map(([category, name, slug, cents, stock, featured, description], i) => ({
    id: uuid(3, i + 1),
    category_id: categories.find((c) => c.slug === category)!.id,
    name,
    slug,
    description,
    price_cents: cents,
    currency: "usd",
    image_url: `/products/${slug}.jpg`,
    stock_quantity: stock,
    is_active: true,
    is_featured: featured,
    created_at: daysAgo(60 - i),
    updated_at: created,
  }));

  const profiles = (Object.entries(DEMO_USERS) as [DemoRole, (typeof DEMO_USERS)[DemoRole]][]).map(([role, u]) => ({
    id: u.id,
    email: u.email,
    full_name: u.fullName,
    role,
    created_at: created,
    updated_at: created,
    welcome_email_sent_at: created,
  }));

  const orders: OrderRow[] = [];
  const orderItems: OrderItemRow[] = [];
  ORDERS.forEach(([lines, status, age], i) => {
    const orderId = uuid(4, i + 1);
    const at = daysAgo(age);
    const items = Object.entries(lines).map(([slug, quantity]) =>
      buildOrderItem(
        orderId,
        products.find((p) => p.slug === slug)!,
        quantity,
        at,
      ),
    );
    orderItems.push(...items);
    orders.push(
      buildOrder(
        {
          id: orderId,
          order_number: 1001 + i,
          user_id: DEMO_USERS.customer.id,
          customer_email: DEMO_USERS.customer.email,
          status,
          created_at: at,
        },
        items,
      ),
    );
  });

  return { categories, products, profiles, orders, orderItems };
}
