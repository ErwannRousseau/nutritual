import { positiveAmountSchema } from "@/features/routines/routine-name-schema";

export type IntakeQuantity = { amount: number; unit: string };

export function formatIntakeAmount(amount: number): string {
  const [coefficient, exponentText] = amount.toString().split("e");

  if (exponentText === undefined) return coefficient;

  const decimalIndex =
    coefficient.indexOf(".") === -1 ? coefficient.length : coefficient.indexOf(".");

  const digits = coefficient.replace(".", "");
  const expandedIndex = decimalIndex + Number(exponentText);

  if (expandedIndex <= 0) return `0.${"0".repeat(-expandedIndex)}${digits}`;

  if (expandedIndex >= digits.length)
    return `${digits}${"0".repeat(expandedIndex - digits.length)}`;

  return `${digits.slice(0, expandedIndex)}.${digits.slice(expandedIndex)}`;
}

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
