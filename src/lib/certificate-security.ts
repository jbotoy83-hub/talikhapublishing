import "server-only";
import { createHash, randomBytes } from "node:crypto";

export function certificateToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: createHash("sha256").update(token).digest("hex") };
}

export function hashCertificateToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function certificateNumber(prefix = "TP-CERT") {
  return `${prefix}-${new Date().getFullYear()}-${randomBytes(4).toString("hex").toLocaleUpperCase()}`;
}
