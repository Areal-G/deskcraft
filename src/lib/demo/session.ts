import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { OrderStatus } from "@/lib/orders/status";
import { decodeSession, encodeSession, SESSION_COOKIE, type CookieOrder, type DemoSession } from "./cookie";
import { buildOrder, buildOrderItem, DEMO_USERS, type DemoRole } from "./data";
import { db, insertOrder, type OrderWithItems } from "./store";

/*
 * Serverless instances do not share memory. Replaying the orders and status
 * changes kept in the visitor's session cookie into this instance's store keeps
 * their own changes visible whichever instance serves the request.
 */
const MAX_AGE = 60 * 60 * 24 * 7;
const MAX_ORDERS = 8;
const MAX_STATUS_CHANGES = 20;

/** Replays the visitor's orders and status changes into the store. Idempotent. */
function replay(session: DemoSession): void {
  for (const o of session.o ?? []) {
    if (db().orders.some((order) => order.id === o.id)) continue;
    const createdAt = new Date(o.t).toISOString();
    const items = o.i.flatMap(([productId, quantity, cents]) => {
      const product = db().products.find((p) => p.id === productId);
      if (!product) return [];
      const item = buildOrderItem(o.id, product, quantity, createdAt);
      return { ...item, unit_price_cents: cents, subtotal_cents: cents * quantity };
    });
    const user = DEMO_USERS[o.r];
    const fields = { id: o.id, order_number: o.n, user_id: user.id, customer_email: user.email, created_at: createdAt };
    insertOrder(buildOrder({ ...fields, status: "paid" }, items), items);
  }
  for (const [orderId, status] of Object.entries(session.s ?? {})) {
    const order = db().orders.find((o) => o.id === orderId);
    if (order && order.status !== status) order.status = status;
  }
}

/** The current visitor's demo session, replayed into the store once per request. */
export const getDemoSession = cache(async (): Promise<DemoSession> => {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  replay(session);
  return session;
});

/** Updates the session cookie. Only callable from Server Actions and Route Handlers. */
export async function updateDemoSession(change: (session: DemoSession) => DemoSession): Promise<void> {
  const next = change(await getDemoSession());
  (await cookies()).set(SESSION_COOKIE, encodeSession(next), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function rememberOrder(session: DemoSession, order: OrderWithItems, role: DemoRole): DemoSession {
  const saved: CookieOrder = {
    id: order.id,
    n: order.order_number,
    t: Date.parse(order.created_at),
    r: role,
    i: order.items.map((i) => [i.product_id ?? "", i.quantity, i.unit_price_cents]),
  };
  return { ...session, o: [...(session.o ?? []), saved].slice(-MAX_ORDERS) };
}

export function rememberStatus(session: DemoSession, orderId: string, status: OrderStatus): DemoSession {
  const entries = Object.entries(session.s ?? {}).filter(([id]) => id !== orderId);
  return { ...session, s: Object.fromEntries([...entries, [orderId, status]].slice(-MAX_STATUS_CHANGES)) };
}
