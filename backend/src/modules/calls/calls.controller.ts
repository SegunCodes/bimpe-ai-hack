import { Request, Response } from "express";
import { idParam } from "../../utils/http";
import { getCall, listCalls } from "./calls.service";

export const callsController = {
  list: async (_req: Request, res: Response): Promise<void> => {
    res.json(await listCalls());
  },
  get: async (req: Request, res: Response): Promise<void> => {
    res.json(await getCall(idParam(req)));
  }
};
