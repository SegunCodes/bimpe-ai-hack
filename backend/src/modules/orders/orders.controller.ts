import { Request, Response } from "express";
import { idParam } from "../../utils/http";
import { businessIdOf } from "../auth/auth";
import { bulkOrdersSchema, createOrderSchema } from "./orders.schema";
import { ordersService } from "./orders.service";

export const ordersController = {
  list: async (req: Request, res: Response): Promise<void> => {
    res.json(await ordersService.list(businessIdOf(req)));
  },
  create: async (req: Request, res: Response): Promise<void> => {
    res.status(201).json(await ordersService.create(businessIdOf(req), createOrderSchema.parse(req.body)));
  },
  createBulk: async (req: Request, res: Response): Promise<void> => {
    const input = bulkOrdersSchema.parse(req.body);
    res.status(201).json(await ordersService.createBulk(businessIdOf(req), input.orders));
  },
  get: async (req: Request, res: Response): Promise<void> => {
    res.json(await ordersService.getWithCalls(businessIdOf(req), idParam(req)));
  },
  startCall: async (req: Request, res: Response): Promise<void> => {
    res.status(201).json(await ordersService.startDeliveryCall(businessIdOf(req), idParam(req)));
  },
  callAllPending: async (req: Request, res: Response): Promise<void> => {
    res.json(await ordersService.callAllPending(businessIdOf(req)));
  }
};
