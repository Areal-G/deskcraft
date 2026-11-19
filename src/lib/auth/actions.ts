"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { DEMO_USERS, type DemoRole } from "@/lib/demo/data";
import { updateDemoSession } from "@/lib/demo/session";
import { safeNextPath } from "@/lib/security/redirect";
import type { FormState } from "@/lib/action-result";
import {
  fieldErrors,
  forgotPasswordSchema,
  profileSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/schemas";

const USE_DEMO_ACCOUNTS = "This demo has no real accounts. Use one of the demo logins on the sign-in page.";

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  return { error: USE_DEMO_ACCOUNTS };
}

/** One-click demo login as the customer or the admin. */
export async function demoSignIn(formData: FormData): Promise<void> {
  const role = formData.get("role");
  if (typeof role !== "string" || !(role in DEMO_USERS)) redirect("/sign-in");

  await updateDemoSession((session) => ({ ...session, u: role as DemoRole }));
  revalidatePath("/", "layout");
  redirect(safeNextPath(formData.get("next"), role === "admin" ? "/admin" : "/account"));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  return { error: USE_DEMO_ACCOUNTS };
}

export async function signOut(): Promise<void> {
  // Keep the visitor's orders and status changes; only forget who is signed in.
  await updateDemoSession((session) => ({ ...session, u: undefined }));
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), error: "Enter a valid email address." };
  return { error: USE_DEMO_ACCOUNTS };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your reset link has expired. Please request a new one." };

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  return { error: "Passwords can't be changed in this demo." };
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };

  const parsed = profileSchema.safeParse({ fullName: formData.get("fullName") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  // Only the full name is editable, as with the column grants in the database.
  user.profile.full_name = parsed.data.fullName;
  user.profile.updated_at = new Date().toISOString();

  revalidatePath("/account");
  return { ok: true, message: "Profile updated." };
}
