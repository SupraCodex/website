
import { z } from "zod";
import { validateZod, ContactInputSchema, CONTACT_LIMITS } from "../../validators/index.ts";

export type ContactInput = z.infer<typeof ContactInputSchema>;

// Bornes réexportées depuis la source unique (plus de duplication divergente).
export { CONTACT_LIMITS };

export function validateContact(body: unknown): ContactInput {
  return validateZod(ContactInputSchema, body, "body");
}
