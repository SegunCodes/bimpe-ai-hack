import { Router } from "express";
import { asyncHandler } from "../../utils/http";
import { callsController as c } from "./calls.controller";

export const callsRoutes = Router();
callsRoutes.get("/", asyncHandler(c.list));
callsRoutes.get("/:id", asyncHandler(c.get));
