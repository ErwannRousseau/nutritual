import { z } from "zod";

export const positiveAmountSchema = z
  .string()
  .trim()
  .regex(/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/)
  .transform((value) => Number(value.replace(",", ".")))
  .pipe(z.number().finite().positive());

export const routineNameSchema = z
  .object({
    productName: z.string().trim().min(1, "Supplement name is required."),
    form: z.string(),
    amount: z.string(),
    unit: z.string(),
  })
  .superRefine(({ amount, unit }, context) => {
    if (Boolean(amount.trim()) !== Boolean(unit.trim())) {
      context.addIssue({
        code: "custom",
        message: "Enter a positive amount and its unit, or clear both.",
        path: ["amount"],
      });
    } else if (amount.trim() && !positiveAmountSchema.safeParse(amount).success) {
      context.addIssue({
        code: "custom",
        message: "Enter a positive amount and its unit, or clear both.",
        path: ["amount"],
      });
    }
  });

export type RoutineNameFields = z.infer<typeof routineNameSchema>;
