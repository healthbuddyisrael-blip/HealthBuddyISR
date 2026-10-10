import { createHmac, timingSafeEqual } from "node:crypto";

// Pure codec for unit tests. Signing keys are provided only by server-only context.ts.
export function sealContext(
  payload: object,
  secret: string,
  expiresAt: number,
) {
  const body = Buffer.from(JSON.stringify({ payload, expiresAt })).toString(
    "base64url",
  );
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}

export function openContext(
  value: string | undefined,
  secret: string,
  now = Date.now(),
): unknown {
  if (!value || value.length > 4096) return null;
  const [body, signature, extra] = value.split(".");
  if (!body || !signature || extra) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return null;
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    );
    if (
      typeof decoded !== "object" ||
      !decoded ||
      !("expiresAt" in decoded) ||
      !("payload" in decoded)
    )
      return null;
    if (typeof decoded.expiresAt !== "number" || decoded.expiresAt <= now)
      return null;
    return decoded.payload;
  } catch {
    return null;
  }
}
