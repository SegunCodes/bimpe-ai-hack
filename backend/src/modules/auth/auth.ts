import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { badRequest, conflict, HttpError, tooManyRequests, unauthorized } from "../../utils/errors";
import { asyncHandler } from "../../utils/http";
import { planStatus } from "../businesses/access";
import { Business, businessesRepository } from "../businesses/businesses.repository";
import { hashPassword, passwordMatches } from "../businesses/passwords";
import { documentInfo, hashCode, logoUrl, sendEmailCode } from "../onboarding/onboarding.service";
import { one, run } from "../../db/pool";
import { emails } from "../../integrations/email";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by requireBusiness: the signed-in business. Every dashboard query is scoped to it. */
      businessId?: number;
    }
  }
}

const BUSINESS_SESSION_DAYS = 30;
const SUSPENDED_MESSAGE = "This account is suspended. Contact support@usetellero.com if you think this is a mistake.";
const ADMIN_SESSION_DAYS = 7;
const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function hmac(key: string, payload: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

function sameText(a: string, b: string): boolean {
  // Hash first so the comparison takes the same time whatever the lengths.
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

// ---------- Sessions ----------
// Tokens carry no secrets and need no storage: "<kind>.<fields>.<expiry>.<signature>".

/** Business session: "b.<businessId>.<expiry>.<sig>", signed with SESSION_SECRET (or one derived from CRON_SECRET). */
export function issueBusinessToken(businessId: number, now = Date.now()): string {
  if (!env.auth.sessionSecret) throw new HttpError(503, "Sign-in is not configured on the server (set CRON_SECRET).");
  const payload = `b.${businessId}.${now + BUSINESS_SESSION_DAYS * DAY_MS}`;
  return `${payload}.${hmac(env.auth.sessionSecret, payload)}`;
}

export function businessIdFromToken(token: string, now = Date.now()): number | null {
  return readBusinessToken(token, now)?.businessId ?? null;
}

/**
 * Session for a business, dated no earlier than its last password change (by the database's
 * clock), so a fresh sign-in is never mistaken for an old session.
 */
function sessionFor(business: Business): string {
  const changed = business.password_changed_at ? new Date(business.password_changed_at).getTime() + 1 : 0;
  return issueBusinessToken(business.id, Math.max(Date.now(), changed));
}

/** A valid business token's id and the moment it was issued (expiry minus its lifetime). */
function readBusinessToken(token: string, now = Date.now()): { businessId: number; issuedAt: number } | null {
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "b" || !env.auth.sessionSecret) return null;
  const [, id, expires, signature] = parts;
  if (!/^\d+$/.test(id) || !/^\d+$/.test(expires) || Number(expires) < now) return null;
  if (!sameText(signature, hmac(env.auth.sessionSecret, `b.${id}.${expires}`))) return null;
  return { businessId: Number(id), issuedAt: Number(expires) - BUSINESS_SESSION_DAYS * DAY_MS };
}

/** Admin session: "a.<expiry>.<sig>", signed with a key derived from ADMIN_PASSWORD (changing it signs the admin out). */
function adminKey(): string {
  return createHash("sha256").update(`tellero-admin-session:${env.admin.password}`).digest("hex");
}

export function issueAdminToken(now = Date.now()): string {
  const payload = `a.${now + ADMIN_SESSION_DAYS * DAY_MS}`;
  return `${payload}.${hmac(adminKey(), payload)}`;
}

export function adminTokenIsValid(token: string, now = Date.now()): boolean {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "a" || !env.admin.password) return false;
  const [, expires, signature] = parts;
  if (!/^\d+$/.test(expires) || Number(expires) < now) return false;
  return sameText(signature, hmac(adminKey(), `a.${expires}`));
}

function bearer(req: Request): string {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

/**
 * Guards every dashboard route and records which business is asking. A session from before
 * the account's last password change is refused, so resetting a password signs out everyone else.
 */
export function requireBusiness(req: Request, _res: Response, next: NextFunction): void {
  const session = readBusinessToken(bearer(req));
  if (!session) return next(unauthorized("Please sign in."));
  businessesRepository
    .findById(session.businessId)
    .then((business) => {
      if (!business) return next(unauthorized("Please sign in."));
      if (business.suspended_at) return next(unauthorized(SUSPENDED_MESSAGE));
      const changed = business.password_changed_at ? new Date(business.password_changed_at).getTime() : 0;
      if (changed > session.issuedAt) return next(unauthorized("Your password was changed. Please sign in again."));
      req.businessId = session.businessId;
      next();
    })
    .catch(next);
}

/** The signed-in business. Only valid behind requireBusiness. */
export function businessIdOf(req: Request): number {
  if (!req.businessId) throw unauthorized("Please sign in.");
  return req.businessId;
}

/** Guards the platform owner's /admin routes. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!env.admin.password) return next(unauthorized("The admin password has not been set up yet (ADMIN_PASSWORD)."));
  if (!adminTokenIsValid(bearer(req))) return next(unauthorized("Please sign in as admin."));
  next();
}

// ---------- Slowing down password guessing ----------
// Per server instance, so it is a speed bump, not a wall: the real protection is a good password.
const attempts = new Map<string, { count: number; since: number }>();
function tooManyAttempts(key: string, now = Date.now()): boolean {
  const entry = attempts.get(key);
  if (!entry || now - entry.since > ATTEMPT_WINDOW_MS) {
    attempts.set(key, { count: 1, since: now });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}
const clientIp = (req: Request) => String(req.headers["x-forwarded-for"] || req.ip || "unknown").split(",")[0].trim();
const pause = () => new Promise((resolve) => setTimeout(resolve, 300));

/** What the dashboard needs to know about the signed-in business, including where it is in onboarding. */
export async function publicBusiness(business: Business) {
  return {
    id: business.id,
    name: business.name,
    email: business.email,
    ownerName: business.owner_name,
    logoUrl: await logoUrl(business.id),
    created_at: business.created_at,
    emailVerified: Boolean(business.email_verified_at),
    verification: {
      status: business.verification_status,
      note: business.verification_note,
      updatedAt: business.verification_updated_at,
      document: await documentInfo(business.id)
    },
    plan: await planStatus(business)
  };
}

// ---------- Routes ----------
const email = z.string().trim().toLowerCase().email().max(254);
const signupSchema = z.object({
  business_name: z.string().trim().min(2, "Enter your business name").max(160),
  owner_name: z.string().trim().min(3, "Enter your full name").max(160),
  email,
  password: z.string().min(8, "Use at least 8 characters").max(200)
});
const loginSchema = z.object({ email, password: z.string().min(1).max(200) });

export const authRoutes = Router();

authRoutes.post("/signup", asyncHandler(async (req, res) => {
  if (tooManyAttempts(`signup:${clientIp(req)}`)) throw tooManyRequests("Too many sign-ups from here. Try again in 15 minutes.");
  const input = signupSchema.parse(req.body);
  if (await businessesRepository.findByEmail(input.email)) throw conflict("An account with this email already exists. Sign in instead.");
  const id = await businessesRepository.insert(input.business_name, input.email, await hashPassword(input.password), input.owner_name);
  const business = (await businessesRepository.findById(id)) as Business;
  await sendEmailCode(business);
  res.status(201).json({ token: sessionFor(business), business: await publicBusiness(business) });
}));

authRoutes.post("/login", asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  if (tooManyAttempts(`login:${clientIp(req)}:${input.email}`)) throw tooManyRequests("Too many tries. Wait 15 minutes and try again.");
  await pause();
  const business = await businessesRepository.findByEmail(input.email);
  // Same message whether the email or the password is wrong, so emails can't be discovered.
  if (!business || business.is_house || !(await passwordMatches(input.password, business.password_hash))) {
    throw unauthorized("That email and password don't match.");
  }
  if (business.suspended_at) throw new HttpError(403, SUSPENDED_MESSAGE);
  attempts.delete(`login:${clientIp(req)}:${input.email}`);
  res.json({ token: sessionFor(business), business: await publicBusiness(business) });
}));

authRoutes.get("/me", requireBusiness, asyncHandler(async (req, res) => {
  const business = await businessesRepository.findById(businessIdOf(req));
  if (!business) throw unauthorized("Please sign in.");
  res.json(await publicBusiness(business));
}));

// ---------- Forgotten password ----------
// A 6-digit code by email, then a new password. The answer is the same whether or not the email
// has an account, so the form can't be used to find out who uses Tellero AI.

const RESET_MINUTES = 15;
const RESET_MAX_TRIES = 5;
const resetHash = (businessId: number, code: string) => hashCode(businessId, `reset:${code}`);

authRoutes.post("/forgot-password", asyncHandler(async (req, res) => {
  const { email: address } = z.object({ email }).parse(req.body);
  if (tooManyAttempts(`forgot:${clientIp(req)}`)) throw tooManyRequests("Too many requests. Try again in 15 minutes.");
  const business = await businessesRepository.findByEmail(address);
  if (business && !business.is_house) {
    const recent = await one<{ seconds: string }>("SELECT EXTRACT(EPOCH FROM now() - sent_at) AS seconds FROM password_resets WHERE business_id = ?", [business.id]);
    // At most one email a minute per account; quietly skip otherwise.
    if (!recent || Number(recent.seconds) >= 60) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      await run(
        `INSERT INTO password_resets (business_id, code_hash, expires_at, attempts, sent_at)
         VALUES (?, ?, now() + make_interval(mins => ?), 0, now())
         ON CONFLICT (business_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, sent_at = now()
         RETURNING business_id`,
        [business.id, resetHash(business.id, code), RESET_MINUTES]
      );
      const sent = await emails.passwordResetCode(business.email, business.owner_name || business.name, code);
      if (!sent && !env.email.resendApiKey && process.env.NODE_ENV !== "production") console.log(`[dev] Password reset code for ${business.email}: ${code}`);
    }
  }
  res.json({ ok: true });
}));

const resetSchema = z.object({
  email,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  password: z.string().min(8, "Use at least 8 characters").max(200)
});

authRoutes.post("/reset-password", asyncHandler(async (req, res) => {
  const input = resetSchema.parse(req.body);
  if (tooManyAttempts(`reset:${clientIp(req)}`)) throw tooManyRequests("Too many tries. Wait 15 minutes and try again.");
  const business = await businessesRepository.findByEmail(input.email);
  const row = business
    ? await one<{ code_hash: string; expires_at: Date; attempts: number }>(
        "SELECT code_hash, expires_at, attempts FROM password_resets WHERE business_id = ?",
        [business.id]
      )
    : undefined;
  const invalid = () => badRequest("That code isn’t right or has expired. Ask for a new one.");
  if (!business || !row) throw invalid();
  if (row.attempts >= RESET_MAX_TRIES || new Date(row.expires_at).getTime() < Date.now()) throw invalid();
  if (!sameText(resetHash(business.id, input.code), row.code_hash)) {
    await run("UPDATE password_resets SET attempts = attempts + 1 WHERE business_id = ?", [business.id]);
    throw invalid();
  }
  await businessesRepository.setPassword(business.id, await hashPassword(input.password));
  // Getting the code proves they own the inbox, so the email counts as confirmed too.
  await businessesRepository.markEmailVerified(business.id);
  await run("DELETE FROM password_resets WHERE business_id = ?", [business.id]);
  const updated = (await businessesRepository.findById(business.id)) as Business;
  res.json({ token: sessionFor(updated), business: await publicBusiness(updated) });
}));

export const adminAuthRoutes = Router();

/** Lets the admin sign-in screen say whether a password exists yet. Reveals nothing else. */
adminAuthRoutes.get("/status", (_req, res) => {
  res.json({ passwordSet: Boolean(env.admin.password) });
});

adminAuthRoutes.post("/login", asyncHandler(async (req, res) => {
  const ip = clientIp(req);
  if (tooManyAttempts(`admin:${ip}`)) throw tooManyRequests("Too many tries. Wait 15 minutes and try again.");
  if (!env.admin.password) throw unauthorized("The admin password has not been set up yet (ADMIN_PASSWORD).");
  const { password } = z.object({ password: z.string().min(1).max(200) }).parse(req.body);
  await pause();
  if (!sameText(password, env.admin.password)) throw unauthorized("That password is not right.");
  attempts.delete(`admin:${ip}`);
  res.json({ token: issueAdminToken() });
}));
