import { timingSafeEqual } from "node:crypto";
import express, { Router } from "express";
import { z } from "zod";
import { one, run } from "../../db/pool";
import { emails } from "../../integrations/email";
import { badRequest, HttpError, notFound, tooManyRequests } from "../../utils/errors";
import { asyncHandler } from "../../utils/http";
import { businessIdOf, requireBusiness } from "../auth/auth";
import { businessesRepository } from "../businesses/businesses.repository";
import {
  DOCUMENT_TYPES,
  MAX_CODE_TRIES,
  MAX_DOCUMENT_BYTES,
  RESEND_GAP_SECONDS,
  documentFile,
  documentInfo,
  hashCode,
  looksLike,
  sendDocument,
  sendEmailCode
} from "./onboarding.service";

/**
 * Onboarding for a new business:
 *   1. confirm the email with a 6-digit code (sent at sign-up; can be resent)
 *   2. upload the CAC registration certificate
 *   3. the platform owner approves it on /admin; only then can the business pay and call
 */

export const onboardingRoutes = Router();
onboardingRoutes.use(requireBusiness);

onboardingRoutes.post("/verify-email", asyncHandler(async (req, res) => {
  const { code } = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") }).parse(req.body);
  const id = businessIdOf(req);
  const business = await businessesRepository.findById(id);
  if (!business) throw notFound("Business");
  if (business.email_verified_at) {
    res.json({ ok: true, alreadyVerified: true });
    return;
  }
  const row = await one<{ code_hash: string; expires_at: Date; attempts: number }>(
    "SELECT code_hash, expires_at, attempts FROM email_codes WHERE business_id = ?",
    [id]
  );
  if (!row) throw badRequest("Ask for a new code first.");
  if (row.attempts >= MAX_CODE_TRIES) throw tooManyRequests("Too many wrong codes. Ask for a new code.");
  if (new Date(row.expires_at).getTime() < Date.now()) throw badRequest("That code has expired. Ask for a new one.");
  const given = Buffer.from(hashCode(id, code));
  const expected = Buffer.from(row.code_hash);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    await run("UPDATE email_codes SET attempts = attempts + 1 WHERE business_id = ?", [id]);
    throw badRequest(`That code isn’t right. ${Math.max(0, MAX_CODE_TRIES - row.attempts - 1)} tries left.`);
  }
  await businessesRepository.markEmailVerified(id);
  await run("DELETE FROM email_codes WHERE business_id = ?", [id]);
  await emails.welcome(business.email, business.owner_name || business.name, business.name);
  res.json({ ok: true });
}));

onboardingRoutes.post("/resend-code", asyncHandler(async (req, res) => {
  const business = await businessesRepository.findById(businessIdOf(req));
  if (!business) throw notFound("Business");
  if (business.email_verified_at) {
    res.json({ ok: true, alreadyVerified: true });
    return;
  }
  const last = await one<{ seconds: string }>("SELECT EXTRACT(EPOCH FROM now() - sent_at) AS seconds FROM email_codes WHERE business_id = ?", [business.id]);
  if (last && Number(last.seconds) < RESEND_GAP_SECONDS) {
    throw tooManyRequests(`Wait ${Math.ceil(RESEND_GAP_SECONDS - Number(last.seconds))} seconds before asking for another code.`);
  }
  await sendEmailCode(business);
  res.json({ ok: true });
}));

/**
 * Upload the CAC certificate as the raw request body (Content-Type: the file's type;
 * X-Filename: the original name). Replaces any earlier upload and sends it for review.
 */
onboardingRoutes.post(
  "/document",
  express.raw({ type: Object.keys(DOCUMENT_TYPES), limit: MAX_DOCUMENT_BYTES }),
  asyncHandler(async (req, res) => {
    const business = await businessesRepository.findById(businessIdOf(req));
    if (!business) throw notFound("Business");
    if (!business.email_verified_at) throw new HttpError(403, "Confirm your email first.");
    if (business.verification_status === "approved") throw badRequest("Your business is already approved.");
    const contentType = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    const data = req.body as Buffer;
    if (!(contentType in DOCUMENT_TYPES) || !Buffer.isBuffer(data)) throw badRequest("Upload a PDF, JPG, PNG or WebP file.");
    if (data.length === 0) throw badRequest("That file is empty.");
    if (!looksLike(contentType, data)) throw badRequest("That file doesn’t look like a PDF or image. Try exporting it again.");
    const rawName = decodeURIComponent(String(req.headers["x-filename"] || "")).replace(/[^\w.\- ()]/g, "").slice(0, 120);
    const filename = rawName || `cac-certificate.${DOCUMENT_TYPES[contentType]}`;

    await run(
      `INSERT INTO business_documents (business_id, filename, content_type, size_bytes, data, uploaded_at)
       VALUES (?, ?, ?, ?, ?, now())
       ON CONFLICT (business_id) DO UPDATE SET filename = EXCLUDED.filename, content_type = EXCLUDED.content_type,
         size_bytes = EXCLUDED.size_bytes, data = EXCLUDED.data, uploaded_at = now()
       RETURNING business_id`,
      [business.id, filename, contentType, data.length, data]
    );
    await businessesRepository.setVerification(business.id, "pending", null);
    await Promise.all([
      emails.documentReceived(business.email, business.owner_name || business.name),
      emails.adminNewDocument(business.name, business.owner_name || "", business.email)
    ]);
    res.status(201).json({ ok: true, document: await documentInfo(business.id) });
  })
);

onboardingRoutes.get("/document", asyncHandler(async (req, res) => {
  const file = await documentFile(businessIdOf(req));
  if (!file) throw notFound("Document");
  sendDocument(res, file);
}));
