/**
 * Public Supabase settings shared by the request-scoped clients. The variables
 * are referenced literally so Next.js can inline them, and validated once so a
 * misconfigured deployment fails with a clear message instead of an opaque
 * fetch error deep inside the SDK.
 */
export function getSupabasePublicConfig(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase configuration: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).",
    );
  }
  return { url, anonKey };
}
