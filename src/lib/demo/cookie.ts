import { createHmac, timingSafeEqual } from "node:crypto";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders/status";
import { DEMO_USERS, type DemoRole } from "./data";

/*
 * The demo session cookie: the signed-in demo role plus the orders placed and
 * status changes made in this browser, signed with HMAC-SHA256. Kept free of
 * request APIs so the proxy can verify it too.
 */
export const SESSION_COOKIE = "deskcraft_demo";

// Baked in at build time by next.config.ts (DEMO_SESSION_SECRET overrides the default).
const SECRET = process.env.DEMO_SESSION_SECRET ?? "";

export type CookieOrder = {
  id: string;
  n: number;
  t: number;
  r: DemoRole;
  i: [productId: string, quantity: number, unitPriceCents: number][];
};
export type DemoSession = { u?: DemoRole; o?: CookieOrder[]; s?: Record<string, OrderStatus> };

const sign = (payload: string) => createHmac("sha256", SECRET).update(payload).digest("base64url");

export function encodeSession(session: DemoSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the session, or an empty one when the cookie is missing, malformed or tampered with. */
export function decodeSession(value: string | undefined): DemoSession {
  const [payload, signature] = value?.split(".") ?? [];
  if (!payload || !signature) return {};
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return {};
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as DemoSession;
    return {
      u: session.u && session.u in DEMO_USERS ? session.u : undefined,
      o: Array.isArray(session.o) ? session.o.filter((o) => o.r in DEMO_USERS && Array.isArray(o.i)) : undefined,
      s: Object.fromEntries(Object.entries(session.s ?? {}).filter(([, status]) => status in ORDER_STATUS_LABEL)),
    };
  } catch {
    return {};
  }
}
