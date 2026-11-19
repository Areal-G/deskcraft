import "server-only";
import { db, withItems } from "@/lib/demo/store";
import { siteUrl } from "@/lib/site";
import { sendEmail } from "@/lib/email/send";
import { orderConfirmationEmail, orderStatusEmail, type EmailOrder } from "@/lib/email/templates";

function loadOrder(orderId: string): (EmailOrder & { email: string }) | null {
  const order = db().orders.find((o) => o.id === orderId);
  if (!order) return null;
  return {
    id: order.id,
    email: order.customer_email,
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    totalCents: order.total_cents,
    items: withItems(order).items.map((i) => ({
      productName: i.product_name,
      quantity: i.quantity,
      unitPriceCents: i.unit_price_cents,
      subtotalCents: i.subtotal_cents,
    })),
  };
}

export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const order = loadOrder(orderId);
  if (!order) return;
  const result = await sendEmail(order.email, orderConfirmationEmail(order, siteUrl()));
  if (result.status === "failed") throw new Error(`Order confirmation email failed: ${result.error}`);
}

export async function sendOrderStatusUpdate(orderId: string): Promise<void> {
  const order = loadOrder(orderId);
  if (!order) return;
  const result = await sendEmail(order.email, orderStatusEmail(order, siteUrl()));
  if (result.status === "failed") throw new Error(`Order status email failed: ${result.error}`);
}
