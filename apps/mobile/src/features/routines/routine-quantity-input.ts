import { z } from "zod";

export const positiveAmountSchema = z
  .string()
  .trim()
  .regex(/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/)
  .transform((value) => Number(value.replace(",", ".")))
  .pipe(z.number().finite().positive());
