import "server-only";
import { getCurrentUser } from "@/lib/auth/session";
import { byNewest, db, withItems } from "@/lib/demo/store";
import type { OrderStatus } from "@/lib/orders/status";

/*
 * Admin reads. Pages call requireAdminPage() first; getCurrentUser() here also
 * replays the visitor's session into the in-memory store.
 */

export async function getDashboardStats() {
  await getCurrentUser();
  const { orders, products } = db();
  const paid = orders.filter((o) => o.payment_status === "paid" && o.status !== "cancelled");

  return {
    revenueCents: paid.reduce((sum, o) => sum + o.total_cents, 0),
    paidOrders: paid.length,
    pendingOrders: orders.filter((o) => o.status === "pending").length,
    toFulfil: orders.filter((o) => o.status === "paid" || o.status === "processing").length,
    lowStock: products
      .filter((p) => p.stock_quantity <= 5 && p.is_active)
      .sort((a, b) => a.stock_quantity - b.stock_quantity),
    recentOrders: [...orders].sort(byNewest).slice(0, 6),
  };
}

export async function listAllProducts() {
  const { products, categories } = db();
  return [...products].sort(byNewest).map((p) => ({
    ...p,
    category: categories.find((c) => c.id === p.category_id) ?? null,
  }));
}

export async function getProductForEdit(id: string) {
  return db().products.find((p) => p.id === id) ?? null;
}

export async function listAllOrders(status?: OrderStatus) {
  await getCurrentUser();
  return db()
    .orders.filter((o) => !status || o.status === status)
    .sort(byNewest)
    .slice(0, 100)
    .map(withItems);
}
