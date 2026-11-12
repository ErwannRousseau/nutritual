import { expect, test } from "bun:test";
import { parseIntakeQuantity } from "@/features/intakes/quantity";

test("intake quantity accepts optional paired positive decimal fields", () => {
  expect(parseIntakeQuantity("", "")).toBeUndefined();
  expect(parseIntakeQuantity("1,5", " capsules ")).toEqual({ amount: 1.5, unit: "capsules" });
  expect(parseIntakeQuantity(".25", "ml")).toEqual({ amount: 0.25, unit: "ml" });
});

test("intake quantity rejects incomplete, non-decimal, zero, and non-finite values", () => {
  for (const [amount, unit] of [
    ["1", ""],
    ["", "capsules"],
    ["0", "ml"],
    ["-1", "ml"],
    ["1e3", "ml"],
    ["1.2.3", "ml"],
    ["9".repeat(400), "ml"],
  ]) {
    expect(parseIntakeQuantity(amount, unit)).toBeNull();
  }
});
