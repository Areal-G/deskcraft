const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Formats an integer amount of cents as USD, e.g. 14900 -> "$149.00". */
export function formatPrice(cents: number): string {
  return usd.format(cents / 100);
}
