import { createHmac, randomInt } from "node:crypto";
import express from "express";
import { env } from "../../config/env";
import { one, run } from "../../db/pool";
import { emails } from "../../integrations/email";
import { Business } from "../businesses/businesses.repository";

/** Shared by sign-up (auth) and the onboarding routes. Imports nothing from auth, so there's no import loop. */

export const CODE_MINUTES = 15;
export const MAX_CODE_TRIES = 5;
export const RESEND_GAP_SECONDS = 60;
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
export const DOCUMENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

/** Codes are stored hashed, so a database leak can't be used to confirm someone's email. */
export function hashCode(businessId: number, code: string): string {
  return createHmac("sha256", env.auth.sessionSecret || "tellero-dev").update(`${businessId}:${code}`).digest("hex");
}

/** Creates a new code (replacing any older one) and emails it. */
export async function sendEmailCode(business: Business): Promise<void> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await run(
    `INSERT INTO email_codes (business_id, code_hash, expires_at, attempts, sent_at)
     VALUES (?, ?, now() + make_interval(mins => ?), 0, now())
     ON CONFLICT (business_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, sent_at = now()
     RETURNING business_id`,
    [business.id, hashCode(business.id, code), CODE_MINUTES]
  );
  const sent = await emails.verificationCode(business.email, business.owner_name || business.name, code);
  // Local development without Resend: show the code in the server log so sign-up can be tested.
  if (!sent && !env.email.resendApiKey && process.env.NODE_ENV !== "production") {
    console.log(`[dev] Email code for ${business.email}: ${code}`);
  }
}

export interface DocumentInfo {
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: Date;
}

export async function documentInfo(businessId: number): Promise<DocumentInfo | null> {
  const row = await one<{ filename: string; content_type: string; size_bytes: number; uploaded_at: Date }>(
    "SELECT filename, content_type, size_bytes, uploaded_at FROM business_documents WHERE business_id = ?",
    [businessId]
  );
  return row ? { filename: row.filename, contentType: row.content_type, sizeBytes: row.size_bytes, uploadedAt: row.uploaded_at } : null;
}

export async function documentFile(businessId: number): Promise<{ filename: string; contentType: string; data: Buffer } | null> {
  const row = await one<{ filename: string; content_type: string; data: Buffer }>(
    "SELECT filename, content_type, data FROM business_documents WHERE business_id = ?",
    [businessId]
  );
  return row ? { filename: row.filename, contentType: row.content_type, data: row.data } : null;
}

/** Sends a stored certificate back as a download. Shared by the business and the admin routes. */
export function sendDocument(res: express.Response, file: { filename: string; contentType: string; data: Buffer }): void {
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `inline; filename="${file.filename.replace(/["\r\n]/g, "")}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(file.data);
}

/** True for a PDF, JPEG, PNG or WebP by its first bytes, whatever the browser claimed. */
export function looksLike(contentType: string, data: Buffer): boolean {
  const head = data.subarray(0, 12);
  if (contentType === "application/pdf") return head.subarray(0, 5).toString("latin1") === "%PDF-";
  if (contentType === "image/jpeg") return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (contentType === "image/png") return head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (contentType === "image/webp") return head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WEBP";
  return false;
}


// ---------- Business logo ----------

export const MAX_LOGO_BYTES = 1024 * 1024;
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

/**
 * A logo's address is /api/public/logo/<id>/<signature>. The signature can't be guessed (so
 * logos can't be listed by counting ids) and changes with every upload (so browsers never show
 * an old one). Logos aren't secret, which lets a plain <img> load them without a session.
 */
function logoSignature(businessId: number, updatedAt: Date): string {
  return createHmac("sha256", env.auth.sessionSecret || "tellero-dev").update(`logo:${businessId}:${updatedAt.getTime()}`).digest("base64url").slice(0, 22);
}

export async function logoUrl(businessId: number): Promise<string | null> {
  const row = await one<{ updated_at: Date }>("SELECT updated_at FROM business_logos WHERE business_id = ?", [businessId]);
  return row ? `/api/public/logo/${businessId}/${logoSignature(businessId, new Date(row.updated_at))}` : null;
}

export async function logoFile(businessId: number, signature: string): Promise<{ contentType: string; data: Buffer } | null> {
  const row = await one<{ content_type: string; data: Buffer; updated_at: Date }>(
    "SELECT content_type, data, updated_at FROM business_logos WHERE business_id = ?",
    [businessId]
  );
  if (!row || logoSignature(businessId, new Date(row.updated_at)) !== signature) return null;
  return { contentType: row.content_type, data: row.data };
}

export async function saveLogo(businessId: number, contentType: string, data: Buffer): Promise<void> {
  await run(
    `INSERT INTO business_logos (business_id, content_type, size_bytes, data, updated_at) VALUES (?, ?, ?, ?, now())
     ON CONFLICT (business_id) DO UPDATE SET content_type = EXCLUDED.content_type, size_bytes = EXCLUDED.size_bytes, data = EXCLUDED.data, updated_at = now()
     RETURNING business_id`,
    [businessId, contentType, data.length, data]
  );
}

export async function removeLogo(businessId: number): Promise<void> {
  await run("DELETE FROM business_logos WHERE business_id = ?", [businessId]);
}
