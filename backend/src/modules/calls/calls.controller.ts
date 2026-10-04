import { Request, Response } from "express";
import { idParam } from "../../utils/http";
import { businessIdOf } from "../auth/auth";
import { getCall, listCalls } from "./calls.service";

export const callsController = {
  list: async (req: Request, res: Response): Promise<void> => {
    res.json(await listCalls(businessIdOf(req)));
  },
  get: async (req: Request, res: Response): Promise<void> => {
    res.json(await getCall(idParam(req), businessIdOf(req)));
  }
};
