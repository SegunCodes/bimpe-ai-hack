import { Router } from "express";
import { asyncHandler } from "../../utils/http";
import { ordersController as c } from "./orders.controller";

export const ordersRoutes = Router();
ordersRoutes.get("/", asyncHandler(c.list));
ordersRoutes.post("/", asyncHandler(c.create));
ordersRoutes.post("/bulk", asyncHandler(c.createBulk));
ordersRoutes.post("/call-all-pending", asyncHandler(c.callAllPending));
ordersRoutes.get("/:id", asyncHandler(c.get));
ordersRoutes.post("/:id/call", asyncHandler(c.startCall));
