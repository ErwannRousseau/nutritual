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

function createRoutineNameSchema(preservedAmount?: string) {
  return z
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
      } else if (
        amount.trim() &&
        amount.trim() !== preservedAmount &&
        !positiveAmountSchema.safeParse(amount).success
      ) {
        context.addIssue({
          code: "custom",
          message: "Enter a positive amount with up to 6 decimal places, or clear both fields.",
          path: ["amount"],
        });
      }
    });
}

export const routineNameSchema = createRoutineNameSchema();

export function routineNameSchemaPreservingAmount(amount: string) {
  return createRoutineNameSchema(amount);
}

export function parseRoutineAmount(input: string, preservedAmount?: string, original?: number) {
  const amount = input.trim();

  if (!amount) return null;

  if (amount === preservedAmount && original !== undefined) return original;

  return positiveAmountSchema.parse(amount);
}

export type RoutineNameFields = z.infer<typeof routineNameSchema>;
