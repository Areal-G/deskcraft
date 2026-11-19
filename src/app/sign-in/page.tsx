import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/auth-forms";
import { Button } from "@/components/ui/button";
import { demoSignIn } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/security/redirect";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link_invalid: "That link is invalid or has expired. Please try again.",
};

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const next = safeNextPath(params.next, "/account");
  if (await getCurrentUser()) redirect(next);
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to check out and track your orders."
      footer={
        <>
          New to Deskcraft?{" "}
          <Link href={`/sign-up`} className="font-medium text-foreground hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <SignInForm next={next} />
      <form action={demoSignIn} className="mt-6 space-y-3 border-t pt-6">
        <p className="text-center text-sm text-muted-foreground">Exploring the demo? Sign in with one click.</p>
        <input type="hidden" name="next" value={params.next ? next : ""} />
        <div className="grid grid-cols-2 gap-3">
          <Button type="submit" name="role" value="customer" variant="outline">
            Demo customer
          </Button>
          <Button type="submit" name="role" value="admin" variant="outline">
            Demo admin
          </Button>
        </div>
      </form>
    </AuthCard>
  );
}
