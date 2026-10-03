import { Request, Response } from "express";
import { getAgentContext } from "./agentContext.service";

export const agentContextController = {
  get: async (req: Request, res: Response): Promise<void> => {
    const phone = typeof req.query.phone === "string" ? req.query.phone : undefined;
    const callId = typeof req.query.call_id === "string" ? req.query.call_id : undefined;
    res.json(await getAgentContext(phone, callId));
  }
};
