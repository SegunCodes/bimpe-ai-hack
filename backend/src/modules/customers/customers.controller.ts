import { Request, Response } from "express";
import { idParam } from "../../utils/http";
import { businessIdOf } from "../auth/auth";
import { createCustomerSchema } from "./customers.schema";
import { customersService } from "./customers.service";

export const customersController = {
  list: async (req: Request, res: Response): Promise<void> => {
    res.json(await customersService.list(businessIdOf(req)));
  },
  create: async (req: Request, res: Response): Promise<void> => {
    const input = createCustomerSchema.parse(req.body);
    res.status(201).json(await customersService.create(businessIdOf(req), input));
  },
  get: async (req: Request, res: Response): Promise<void> => {
    res.json(await customersService.getWithCalls(businessIdOf(req), idParam(req)));
  },
  startCall: async (req: Request, res: Response): Promise<void> => {
    res.status(201).json(await customersService.startOnboardingCall(businessIdOf(req), idParam(req)));
  }
};
