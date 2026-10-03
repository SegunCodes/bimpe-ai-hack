import { Router } from "express";
import { asyncHandler } from "../../utils/http";
import { agentContextController } from "./agentContext.controller";

export const agentContextRoutes = Router();
agentContextRoutes.get("/", asyncHandler(agentContextController.get));
