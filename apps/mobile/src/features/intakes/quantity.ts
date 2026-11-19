import { positiveAmountSchema } from "@/features/routines/routine-name-schema";

export type IntakeQuantity = { amount: number; unit: string };

export function parseIntakeQuantity(amount: string, unit: string) {
  const amountText = amount.trim();
  const unitText = unit.trim();

  if (amountText === "" && unitText === "") return undefined;

  if (amountText === "" || unitText === "") return null;

  const parsedAmount = positiveAmountSchema.safeParse(amountText);

  if (!parsedAmount.success) return null;

  return { amount: parsedAmount.data, unit: unitText };
}
