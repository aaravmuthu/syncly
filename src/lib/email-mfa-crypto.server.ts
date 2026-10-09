import { createHmac } from "node:crypto";
export function codeDigest(
  secret: string,
  userId: string,
  session: string,
  challenge: string,
  purpose: "enroll" | "verify" | "disable",
  code: string,
) {
  return createHmac("sha256", secret)
    .update(JSON.stringify([userId, session, challenge, purpose, code]))
    .digest("hex");
}
