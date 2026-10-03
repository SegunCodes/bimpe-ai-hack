import { Router } from "express";
import { verifyWebhookSecret } from "../../middleware/webhookAuth";
import { asyncHandler } from "../../utils/http";
import { webhooksController } from "./webhooks.controller";

export const webhooksRoutes = Router();
webhooksRoutes.post("/bimpe", verifyWebhookSecret, asyncHandler(webhooksController.bimpe));
