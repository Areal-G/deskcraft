import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { DEMO_USERS } from "@/lib/demo/data";
import { db } from "@/lib/demo/store";
import { getDemoSession } from "@/lib/demo/session";
import type { Database } from "@/lib/types/database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type SessionUser = {
  id: string;
  email: string;
  profile: Profile;
};

/**
 * Returns the signed-in demo user and their profile, or null. The role comes
 * from the signed demo session cookie. Cached per request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const { u: role } = await getDemoSession();
  if (!role) return null;

  const profile = db().profiles.find((p) => p.id === DEMO_USERS[role].id);
  if (!profile) return null;

  return { id: profile.id, email: profile.email, profile };
});

export async function requireUser(nextPath = "/account"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export function isAdmin(user: Pick<SessionUser, "profile"> | null | undefined): boolean {
  return user?.profile.role === "admin";
}

/**
 * For admin pages. Layouts and pages render in parallel, so each admin page
 * checks the role itself instead of relying on the admin layout.
 */
export async function requireAdminPage(nextPath = "/admin"): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (!isAdmin(user)) notFound();
  return user;
}

export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function assertAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) throw new ForbiddenError();
  return user;
}
