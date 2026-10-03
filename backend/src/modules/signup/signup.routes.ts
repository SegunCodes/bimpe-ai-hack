import { Router } from "express";
import { asyncHandler } from "../../utils/http";
import { signupController } from "./signup.controller";

export const signupRoutes = Router();
signupRoutes.post("/signup", asyncHandler(signupController.signup));
