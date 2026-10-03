import { Request, Response } from "express";
import { signup, signupSchema } from "./signup.service";

export const signupController = {
  signup: async (req: Request, res: Response): Promise<void> => {
    await signup(signupSchema.parse(req.body));
    res.json({ ok: true });
  }
};
