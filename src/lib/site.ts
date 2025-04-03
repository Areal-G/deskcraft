export const STORE_NAME = "Deskcraft";

/** Absolute base URL of the app, without a trailing slash. */
export function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return url.replace(/\/+$/, "");
}
