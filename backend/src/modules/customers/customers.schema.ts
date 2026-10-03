import { z } from "zod";

export const languageSchema = z.enum(["en", "pcm", "yo", "ha", "ig"]);

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().min(1),
  language: languageSchema.optional(),
  address: z.string().trim().max(2000).optional(),
  landmark: z.string().trim().max(255).optional()
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
