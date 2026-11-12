import { z } from "zod";

export function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    useGrouping: false,
    maximumSignificantDigits: 17,
  }).format(amount);
}

export const positiveAmountSchema = z
  .string()
  .trim()
  .regex(/^(?:\d+(?:[.,]\d{1,6})?|[.,]\d{1,6})$/, {
    message: "Enter a positive amount with up to 6 decimal places.",
  })
  .transform((value) => Number(value.replace(",", ".")))
  .pipe(z.number().finite().positive());

export const quantitySchema = z
  .object({ amount: z.string(), unit: z.string() })
  .superRefine(({ amount, unit }, context) => {
    if (!amount.trim() && unit.trim()) {
      context.addIssue({
        code: "custom",
        message: "Enter an amount.",
        path: ["amount"],
      });
    } else if (amount.trim() && !positiveAmountSchema.safeParse(amount).success) {
      context.addIssue({
        code: "custom",
        message: "Enter a positive amount with up to 6 decimal places.",
        path: ["amount"],
      });
    } else if (amount.trim() && !unit.trim()) {
      context.addIssue({
        code: "custom",
        message: "Choose a unit.",
        path: ["amount"],
      });
    }
  });

export const routineNameSchema = quantitySchema.safeExtend({
  productName: z.string().trim().min(1, "Supplement name is required."),
  form: z.string(),
});

export type RoutineNameFields = z.infer<typeof routineNameSchema>;
