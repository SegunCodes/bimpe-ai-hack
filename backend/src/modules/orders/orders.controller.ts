import { Request, Response } from "express";
import { idParam } from "../../utils/http";
import { bulkOrdersSchema, createOrderSchema } from "./orders.schema";
import { ordersService } from "./orders.service";

export const ordersController = {
  list: async (_req: Request, res: Response): Promise<void> => {
    res.json(await ordersService.list());
  },
  create: async (req: Request, res: Response): Promise<void> => {
    res.status(201).json(await ordersService.create(createOrderSchema.parse(req.body)));
  },
  createBulk: async (req: Request, res: Response): Promise<void> => {
    const input = bulkOrdersSchema.parse(req.body);
    res.status(201).json(await ordersService.createBulk(input.orders));
  },
  get: async (req: Request, res: Response): Promise<void> => {
    res.json(await ordersService.getWithCalls(idParam(req)));
  },
  startCall: async (req: Request, res: Response): Promise<void> => {
    res.status(201).json(await ordersService.startDeliveryCall(idParam(req)));
  },
  callAllPending: async (_req: Request, res: Response): Promise<void> => {
    res.json(await ordersService.callAllPending());
  }
};
