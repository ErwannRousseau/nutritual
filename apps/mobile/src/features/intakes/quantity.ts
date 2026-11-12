import { positiveAmountSchema } from "@/features/routines/routine-name-schema";
import { z } from "zod";

export type IntakeQuantity = { amount: number; unit: string };

export const intakeQuantitySchema = z
  .object({ amount: z.string(), unit: z.string() })
  .refine(({ amount, unit }) => parseIntakeQuantity(amount, unit) !== null, {
    path: ["amount"],
    message:
      "Enter a positive amount with up to 6 decimal places and its unit, or clear both fields.",
  });

export function parseIntakeQuantity(
  amount: string,
  unit: string,
): IntakeQuantity | undefined | null {
  const amountText = amount.trim();
  const unitText = unit.trim();

  if (amountText === "" && unitText === "") return undefined;

  if (amountText === "" || unitText === "") return null;

  const parsedAmount = positiveAmountSchema.safeParse(amountText);

  if (!parsedAmount.success) return null;

  return { amount: parsedAmount.data, unit: unitText };
}
