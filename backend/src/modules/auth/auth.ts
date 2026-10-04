import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { conflict, HttpError, tooManyRequests, unauthorized } from "../../utils/errors";
import { asyncHandler } from "../../utils/http";
import { planStatus } from "../businesses/access";
import { Business, businessesRepository } from "../businesses/businesses.repository";
import { hashPassword, passwordMatches } from "../businesses/passwords";
import { documentInfo, sendEmailCode } from "../onboarding/onboarding.service";

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
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "b" || !env.auth.sessionSecret) return null;
  const [, id, expires, signature] = parts;
  if (!/^\d+$/.test(id) || !/^\d+$/.test(expires) || Number(expires) < now) return null;
  return sameText(signature, hmac(env.auth.sessionSecret, `b.${id}.${expires}`)) ? Number(id) : null;
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

/** Guards every dashboard route and records which business is asking. */
export function requireBusiness(req: Request, _res: Response, next: NextFunction): void {
  const businessId = businessIdFromToken(bearer(req));
  if (!businessId) return next(unauthorized("Please sign in."));
  req.businessId = businessId;
  next();
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
  res.status(201).json({ token: issueBusinessToken(id), business: await publicBusiness(business) });
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
  attempts.delete(`login:${clientIp(req)}:${input.email}`);
  res.json({ token: issueBusinessToken(business.id), business: await publicBusiness(business) });
}));

authRoutes.get("/me", requireBusiness, asyncHandler(async (req, res) => {
  const business = await businessesRepository.findById(businessIdOf(req));
  if (!business) throw unauthorized("Please sign in.");
  res.json(await publicBusiness(business));
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
