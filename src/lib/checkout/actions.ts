"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { getCartProducts } from "@/lib/catalog";
import type { CartProduct } from "@/lib/cart/cart";
import { placeOrder } from "@/lib/demo/store";
import { rememberOrder, updateDemoSession } from "@/lib/demo/session";
import { sendOrderConfirmation } from "@/lib/email/notifications";
import { checkoutSchema, productIdsSchema } from "@/lib/validation/schemas";

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string; code?: "UNAUTHENTICATED" | "STOCK" | "INVALID" | "UNAVAILABLE" };

/** Returns authoritative product data for the ids in the visitor's cart. */
export async function loadCartProducts(ids: unknown): Promise<CartProduct[]> {
  const parsed = productIdsSchema.safeParse(ids);
  if (!parsed.success) return [];
  return getCartProducts(parsed.data);
}

const ORDER_ERRORS = {
  INSUFFICIENT_STOCK: {
    ok: false,
    code: "STOCK",
    error: "Some items are no longer available in the quantity you selected. Please review your cart.",
  },
  PRODUCT_UNAVAILABLE: {
    ok: false,
    code: "STOCK",
    error: "A product in your cart is no longer available. Please review your cart.",
  },
  INVALID_QUANTITY: { ok: false, code: "INVALID", error: "Your cart contains an invalid quantity." },
} satisfies Record<string, CheckoutResult>;

/**
 * Places the order. The client sends only product ids and quantities; prices,
 * names and totals come from the catalog, and stock is reserved atomically.
 * The demo has no payment provider, so the order is paid immediately and the
 * customer goes straight to the order confirmation page.
 */
export async function startCheckout(input: unknown): Promise<CheckoutResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, code: "UNAUTHENTICATED", error: "Please sign in to check out." };

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "INVALID", error: parsed.error.issues[0]?.message ?? "Invalid cart." };
  }

  const result = placeOrder(user, parsed.data.items);
  if ("error" in result) return ORDER_ERRORS[result.error];
  const { order } = result;

  await updateDemoSession((session) => rememberOrder(session, order, user.profile.role));
  await sendOrderConfirmation(order.id);

  return { ok: true, url: `/checkout/success?session_id=${order.stripe_checkout_session_id}` };
}
