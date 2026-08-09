import type { EmailRecipient } from "./types";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function resolveSubmissionRecipients(submission: { author_name: string; author_email: string; author_details: unknown }) {
  const recipients = new Map<string, EmailRecipient>();
  const add = (email: unknown, name: unknown) => {
    if (typeof email !== "string") return;
    const normalized = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || recipients.has(normalized)) return;
    recipients.set(normalized, { email: normalized, name: typeof name === "string" && name.trim() ? name.trim() : "Author" });
  };
  add(submission.author_email, submission.author_name);
  if (Array.isArray(submission.author_details)) {
    for (const author of submission.author_details) {
      if (!author || typeof author !== "object") continue;
      const item = author as Record<string, unknown>;
      const name = [item.firstName, item.middleInitial, item.surname].filter((part): part is string => typeof part === "string" && Boolean(part.trim())).join(" ");
      add(item.email, name);
    }
  }
  return [...recipients.values()];
}
