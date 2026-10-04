import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { tooManyRequests, unauthorized } from "../../utils/errors";
import { asyncHandler } from "../../utils/http";

const SESSION_DAYS = 30;
const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/** Signing key derived from the password, so changing ADMIN_PASSWORD signs everyone out. */
function signingKey(): Buffer {
  return createHash("sha256").update(`tellero-admin-session:${env.admin.password}`).digest();
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

function sameText(a: string, b: string): boolean {
  // Hash first so the comparison takes the same time whatever the lengths.
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
}

/** A session token is "<expiry ms>.<signature>": nothing secret inside, nothing to store. */
export function issueToken(now = Date.now()): { token: string; expiresAt: string } {
  const expires = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  return { token: `${expires}.${sign(String(expires))}`, expiresAt: new Date(expires).toISOString() };
}

export function tokenIsValid(token: string, now = Date.now()): boolean {
  if (!env.admin.password) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature || !/^\d+$/.test(expires) || Number(expires) < now) return false;
  return sameText(signature, sign(expires));
}

/** Guards every dashboard route: needs "Authorization: Bearer <session token>". */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!env.admin.password) return next(unauthorized("The dashboard password has not been set up yet (ADMIN_PASSWORD)."));
  if (!token || !tokenIsValid(token)) return next(unauthorized("Please sign in to the dashboard."));
  next();
}

// Slows down password guessing. Per server instance, so it is a speed bump, not a wall:
// the real protection is a long password.
const attempts = new Map<string, { count: number; since: number }>();
function tooManyAttempts(ip: string, now = Date.now()): boolean {
  const entry = attempts.get(ip);
  if (!entry || now - entry.since > ATTEMPT_WINDOW_MS) {
    attempts.set(ip, { count: 1, since: now });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

const loginSchema = z.object({ password: z.string().min(1).max(200) });

export const authRoutes = Router();

/** Lets the sign-in screen say whether a password exists yet. Reveals nothing else. */
authRoutes.get("/status", (_req, res) => {
  res.json({ passwordSet: Boolean(env.admin.password) });
});

authRoutes.post("/login", asyncHandler(async (req, res) => {
  const ip = String(req.headers["x-forwarded-for"] || req.ip || "unknown").split(",")[0].trim();
  if (tooManyAttempts(ip)) throw tooManyRequests("Too many tries. Wait 15 minutes and try again.");
  if (!env.admin.password) throw unauthorized("The dashboard password has not been set up yet (ADMIN_PASSWORD).");
  const { password } = loginSchema.parse(req.body);
  // A short pause on every attempt makes guessing slower without bothering a real person.
  await new Promise((resolve) => setTimeout(resolve, 400));
  if (!sameText(password, env.admin.password)) throw unauthorized("That password is not right.");
  attempts.delete(ip);
  res.json(issueToken());
}));
