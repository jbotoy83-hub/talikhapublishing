import "server-only";
import { randomUUID } from "node:crypto";

type TurnstileVerification = {
  success?: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

export async function verifyTurnstileToken(token: string, remoteIp: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret || !token) return false;

  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  body.set("idempotency_key", randomUUID());
  if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(8_000)
      }
    );
    if (!response.ok) return false;
    const result = (await response.json()) as TurnstileVerification;
    return result.success === true && result.action === "submission";
  } catch {
    return false;
  }
}
