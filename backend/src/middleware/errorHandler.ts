import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/errors";

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  // The webhook must always answer 200 so BimpeAI never retries forever.
  if (req.path.endsWith("/webhooks/bimpe")) {
    console.error("Unexpected BimpeAI webhook error:", error);
    res.status(200).json({ ok: true });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", details: error.flatten() });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error && typeof error === "object" && "code" in error && error.code === "23505") {
    res.status(409).json({ error: "A customer with this phone number already exists" });
    return;
  }
  console.error("API error:", error);
  res.status(500).json({ error: "Internal server error" });
}
