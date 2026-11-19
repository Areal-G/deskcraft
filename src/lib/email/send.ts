import "server-only";
import type { EmailContent } from "@/lib/email/templates";

export type SendResult =
  { status: "sent"; id: string } | { status: "skipped"; reason: string } | { status: "failed"; error: string };

/** The demo has no email provider: emails are logged and reported as "skipped". */
export async function sendEmail(to: string, content: EmailContent): Promise<SendResult> {
  console.info(`[email] demo mode — email NOT sent. to=${to} subject="${content.subject}"`);
  return { status: "skipped", reason: "Email is disabled in the demo" };
}
