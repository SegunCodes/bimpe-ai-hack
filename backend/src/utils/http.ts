import { NextFunction, Request, Response } from "express";
import { badRequest } from "./errors";

export function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void handler(req, res).catch(next);
  };
}

export function idParam(req: Request, name = "id"): number {
  const value = Number(req.params[name]);
  if (!Number.isInteger(value) || value <= 0) throw badRequest(`Invalid ${name}`);
  return value;
}
