import { expect, test } from "bun:test";
import { parseIntakeQuantity } from "@/features/intakes/quantity";
import { formatAmount } from "@/features/routines/routine-name-schema";

test("intake quantity accepts optional paired positive decimal fields", () => {
  expect(parseIntakeQuantity("", "")).toBeUndefined();
  expect(parseIntakeQuantity("1,5", " capsules ")).toEqual({ amount: 1.5, unit: "capsules" });
  expect(parseIntakeQuantity(".25", "ml")).toEqual({ amount: 0.25, unit: "ml" });
  expect(parseIntakeQuantity("0.000001", "mg")).toEqual({ amount: 0.000001, unit: "mg" });
});

test("intake quantity rejects incomplete, non-decimal, zero, and non-finite values", () => {
  for (const [amount, unit] of [
    ["1", ""],
    ["", "capsules"],
    ["0", "ml"],
    ["-1", "ml"],
    ["1e3", "ml"],
    ["1.2.3", "ml"],
    ["0.0000001", "mg"],
    ["1,1234567", "mg"],
    ["9".repeat(400), "ml"],
  ]) {
    expect(parseIntakeQuantity(amount, unit)).toBeNull();
  }
});

test("planned amounts prefill without changing their value", () => {
  for (const amount of [0.000001, 1.5, 1e21]) {
    expect(parseIntakeQuantity(formatAmount(amount), "mg")).toEqual({ amount, unit: "mg" });
  }
});
