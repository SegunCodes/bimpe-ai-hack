import { Router } from "express";
import { asyncHandler } from "../../utils/http";
import { customersController as c } from "./customers.controller";

export const customersRoutes = Router();
customersRoutes.get("/", asyncHandler(c.list));
customersRoutes.post("/", asyncHandler(c.create));
customersRoutes.get("/:id", asyncHandler(c.get));
customersRoutes.post("/:id/call", asyncHandler(c.startCall));
