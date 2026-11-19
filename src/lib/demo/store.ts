import "server-only";
import { canTransition, type OrderStatus } from "@/lib/orders/status";
import {
  buildOrder,
  buildOrderItem,
  createDemoData,
  type DemoData,
  type OrderItemRow,
  type OrderRow,
  type ProductRow,
} from "./data";

/*
 * The demo's in-memory database. It is created synchronously on first use in
 * each server instance (so seeding cannot race with a request) and starts over
 * on every cold start. Orders placed and status changes made by a visitor are
 * also kept in their session cookie and replayed here, see lib/demo/session.ts.
 */
const holder = globalThis as typeof globalThis & { __deskcraftDemo?: DemoData };

export function db(): DemoData {
  return (holder.__deskcraftDemo ??= createDemoData());
}

export type OrderWithItems = OrderRow & { items: OrderItemRow[] };

export function withItems(order: OrderRow): OrderWithItems {
  return { ...order, items: db().orderItems.filter((i) => i.order_id === order.id) };
}

export function withCategory(product: ProductRow) {
  const category = db().categories.find((c) => c.id === product.category_id);
  return { ...product, category: category ? { name: category.name, slug: category.slug } : null };
}

export const byNewest = (a: { created_at: string }, b: { created_at: string }) =>
  b.created_at.localeCompare(a.created_at);

function nextOrderNumber(): number {
  return Math.max(1000, ...db().orders.map((o) => o.order_number)) + 1;
}

export function insertOrder(order: OrderRow, items: OrderItemRow[]): void {
  db().orders.push(order);
  db().orderItems.push(...items);
}

/** Mirrors public.create_order(): prices come from the catalog and stock is reserved atomically. */
export function placeOrder(
  user: { id: string; email: string },
  lines: { productId: string; quantity: number }[],
): { order: OrderWithItems } | { error: "PRODUCT_UNAVAILABLE" | "INSUFFICIENT_STOCK" | "INVALID_QUANTITY" } {
  const quantities = new Map<string, number>();
  for (const l of lines) quantities.set(l.productId, (quantities.get(l.productId) ?? 0) + l.quantity);

  const picked: [ProductRow, number][] = [];
  for (const [productId, quantity] of quantities) {
    const product = db().products.find((p) => p.id === productId && p.is_active);
    if (!product) return { error: "PRODUCT_UNAVAILABLE" };
    if (!Number.isInteger(quantity) || quantity < 1) return { error: "INVALID_QUANTITY" };
    if (product.stock_quantity < quantity) return { error: "INSUFFICIENT_STOCK" };
    picked.push([product, quantity]);
  }
  if (picked.length === 0) return { error: "INVALID_QUANTITY" };

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const items = picked.map(([product, quantity]) => {
    product.stock_quantity -= quantity;
    return buildOrderItem(id, product, quantity, now);
  });
  // No payment provider in the demo: the order is paid as soon as it is placed.
  const order = buildOrder(
    {
      id,
      order_number: nextOrderNumber(),
      user_id: user.id,
      customer_email: user.email,
      status: "paid",
      created_at: now,
    },
    items,
  );
  insertOrder(order, items);
  return { order: { ...order, items } };
}

/** Mirrors the guard_order_status_change() and restock_cancelled_order() triggers. */
export function changeOrderStatus(
  orderId: string,
  status: OrderStatus,
): "OK" | "NOT_FOUND" | "ORDER_NOT_PAID" | "INVALID_STATUS_TRANSITION" {
  const order = db().orders.find((o) => o.id === orderId);
  if (!order) return "NOT_FOUND";
  if (status === order.status) return "OK";
  if (status !== "cancelled" && order.payment_status !== "paid") return "ORDER_NOT_PAID";
  if (!canTransition(order.status, status, order.payment_status)) return "INVALID_STATUS_TRANSITION";

  if (status === "cancelled") {
    for (const item of db().orderItems.filter((i) => i.order_id === orderId)) {
      const product = db().products.find((p) => p.id === item.product_id);
      if (product) product.stock_quantity += item.quantity;
    }
  }
  order.status = status;
  order.updated_at = new Date().toISOString();
  return "OK";
}
