import { Request, Response } from "express";
import { parseWebhook } from "../../integrations/bimpeClient";
import { applyCallResult } from "../calls/callResults.service";

export const webhooksController = {
  /** Never crashes and always answers 200, so BimpeAI does not keep retrying. */
  bimpe: async (req: Request, res: Response): Promise<void> => {
    const rawBody = req.body as Buffer;
    try {
      await applyCallResult(parseWebhook(rawBody, req.headers));
    } catch (error) {
      console.error("Unexpected BimpeAI webhook payload:", rawBody?.toString("utf8"), error);
    }
    res.status(200).json({ ok: true });
  }
};
