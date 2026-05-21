import { createHash, randomBytes } from "crypto";

const DEFAULT_SESSION_TTL_DAYS = 30;

export function readSessionTtlMs(): number {
  const rawTtlDays = process.env["SESSION_TTL_DAYS"]?.trim();
  if (!rawTtlDays) return DEFAULT_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

  const ttlDays = Number(rawTtlDays);
  if (!Number.isInteger(ttlDays) || ttlDays < 1 || ttlDays > 365) {
    throw new Error("SESSION_TTL_DAYS must be an integer from 1 to 365.");
  }

  return ttlDays * 24 * 60 * 60 * 1000;
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(sessionToken: string): string {
  return createHash("sha256").update(sessionToken).digest("hex");
}

export function normalizeSessionToken(sessionToken: string): string {
  const value = sessionToken.trim();
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    return "";
  }

  return value.toLowerCase();
}
