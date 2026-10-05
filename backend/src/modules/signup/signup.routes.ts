import { Router } from "express";
import { asyncHandler } from "../../utils/http";
import { logoFile } from "../onboarding/onboarding.service";
import { signupController } from "./signup.controller";

export const signupRoutes = Router();
signupRoutes.post("/signup", asyncHandler(signupController.signup));

/** A business logo, by its signed address (see onboarding.service logoUrl). */
signupRoutes.get("/logo/:id/:signature", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const file = Number.isInteger(id) && id > 0 ? await logoFile(id, String(req.params.signature)) : null;
  if (!file) {
    res.status(404).end();
    return;
  }
  res.setHeader("Content-Type", file.contentType);
  // The address changes with every upload, so the image can be cached for a long time.
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'");
  res.send(file.data);
}));
