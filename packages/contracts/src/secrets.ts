import { z } from "zod";

export const secretStatusSchema = z.enum([
  "pending",
  "validated",
  "expired",
  "revoked",
  "rotation_required",
]);

export type SecretStatus = z.infer<typeof secretStatusSchema>;

export const secretDescriptorSchema = z.object({
  id: z.string(),
  label: z.string(),
  provider: z.string(),
  status: secretStatusSchema,
  updatedAt: z.string(),
});

export type SecretDescriptor = z.infer<typeof secretDescriptorSchema>;
