import { createHmac } from "crypto";

// A per-wedding key for the TAKEMIND photographer's upload link (no admin key needed on their phone).
// Made from the admin key, so changing ADMIN_KEY also cancels every photographer link.
export function proToken(weddingId: string) {
  const secret = process.env.ADMIN_KEY;
  if (!secret) return null;
  return createHmac("sha256", secret).update(`pro:${weddingId}`).digest("hex").slice(0, 24);
}

export function isProKey(weddingId: string, key: unknown) {
  if (typeof key !== "string" || !key) return false;
  if (process.env.ADMIN_KEY && key === process.env.ADMIN_KEY) return true;
  return key === proToken(weddingId);
}
