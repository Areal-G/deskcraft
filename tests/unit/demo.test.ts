import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession } from "@/lib/demo/cookie";
import { DEMO_USERS } from "@/lib/demo/data";
import { changeOrderStatus, db, placeOrder } from "@/lib/demo/store";

describe("demo session cookie", () => {
  it("round-trips a signed session", () => {
    const session = { u: "admin" as const, s: { "order-1": "shipped" as const } };
    expect(decodeSession(encodeSession(session))).toEqual({ ...session, o: undefined });
  });

  it("rejects tampered or malformed cookies", () => {
    const [payload, signature] = encodeSession({ u: "customer" }).split(".");
    const forged = Buffer.from(JSON.stringify({ u: "admin" })).toString("base64url");
    expect(decodeSession(`${forged}.${signature}`)).toEqual({});
    expect(decodeSession(`${payload}.x${signature}`)).toEqual({});
    expect(decodeSession("garbage")).toEqual({});
    expect(decodeSession(undefined)).toEqual({});
  });
});

describe("demo store", () => {
  const customer = { id: DEMO_USERS.customer.id, email: DEMO_USERS.customer.email };
  const product = () => db().products.find((p) => p.slug === "nexus-8-in-1-usb-c-hub")!;

  it("places a paid order at catalog prices and reserves stock", () => {
    const before = product().stock_quantity;
    const result = placeOrder(customer, [{ productId: product().id, quantity: 2 }]);
    if ("error" in result) throw new Error(result.error);
    expect(result.order).toMatchObject({ status: "paid", payment_status: "paid", total_cents: 2 * 5900 });
    expect(product().stock_quantity).toBe(before - 2);
  });

  it("refuses to oversell or sell inactive products", () => {
    expect(placeOrder(customer, [{ productId: product().id, quantity: 10_000 }])).toEqual({
      error: "INSUFFICIENT_STOCK",
    });
    const soldOut = db().products.find((p) => p.stock_quantity === 0)!;
    expect(placeOrder(customer, [{ productId: soldOut.id, quantity: 1 }])).toEqual({ error: "INSUFFICIENT_STOCK" });
    expect(placeOrder(customer, [{ productId: crypto.randomUUID(), quantity: 1 }])).toEqual({
      error: "PRODUCT_UNAVAILABLE",
    });
  });

  it("follows the order lifecycle and restocks cancelled orders", () => {
    const result = placeOrder(customer, [{ productId: product().id, quantity: 1 }]);
    if ("error" in result) throw new Error(result.error);
    const stock = product().stock_quantity;
    expect(changeOrderStatus(result.order.id, "delivered")).toBe("INVALID_STATUS_TRANSITION");
    expect(changeOrderStatus(result.order.id, "cancelled")).toBe("OK");
    expect(product().stock_quantity).toBe(stock + 1);
    const pending = db().orders.find((o) => o.status === "pending")!;
    expect(changeOrderStatus(pending.id, "shipped")).toBe("ORDER_NOT_PAID");
  });
});
