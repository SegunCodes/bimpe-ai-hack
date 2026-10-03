import { Request, Response } from "express";
import { idParam } from "../../utils/http";
import { createCustomerSchema } from "./customers.schema";
import { customersService } from "./customers.service";

export const customersController = {
  list: async (_req: Request, res: Response): Promise<void> => {
    res.json(await customersService.list());
  },
  create: async (req: Request, res: Response): Promise<void> => {
    const input = createCustomerSchema.parse(req.body);
    res.status(201).json(await customersService.create(input));
  },
  get: async (req: Request, res: Response): Promise<void> => {
    res.json(await customersService.getWithCalls(idParam(req)));
  },
  startCall: async (req: Request, res: Response): Promise<void> => {
    res.status(201).json(await customersService.startOnboardingCall(idParam(req)));
  }
};
