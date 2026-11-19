import "server-only";
import { getCurrentUser, isAdmin } from "@/lib/auth/session";
import { byNewest, db, withItems } from "@/lib/demo/store";
import type { Database } from "@/lib/types/database";

export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type OrderWithItems = Order & { items: OrderItem[] };

/**
 * Stands in for Row Level Security: a customer only ever sees their own
 * orders, admins see all. getCurrentUser() also replays the visitor's session
 * into the store, so it runs before any lookup.
 */
async function findVisibleOrder(match: (order: Order) => boolean): Promise<OrderWithItems | null> {
  const user = await getCurrentUser();
  const order = db().orders.find(match);
  if (!order || !user || (order.user_id !== user.id && !isAdmin(user))) return null;
  return withItems(order);
}

export async function listMyOrders(userId: string): Promise<OrderWithItems[]> {
  await getCurrentUser();
  return db()
    .orders.filter((o) => o.user_id === userId)
    .sort(byNewest)
    .slice(0, 50)
    .map(withItems);
}

export async function getOrder(orderId: string): Promise<OrderWithItems | null> {
  return findVisibleOrder((o) => o.id === orderId);
}

export async function getOrderByCheckoutSession(sessionId: string): Promise<OrderWithItems | null> {
  if (!sessionId) return null;
  return findVisibleOrder((o) => o.stripe_checkout_session_id === sessionId);
}
