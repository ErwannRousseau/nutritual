import { describe, expect, test } from "bun:test";
import { positiveAmountSchema, routineNameSchema } from "@/features/routines/routine-name-schema";

const validName = { productName: "Vitamin D", form: "", amount: "", unit: "" };

describe("routineNameSchema", () => {
  test("accepts an omitted quantity", () => {
    expect(routineNameSchema.safeParse(validName).success).toBe(true);
  });

  test("accepts positive decimal quantities", () => {
    expect(
      routineNameSchema.safeParse({ ...validName, amount: "1,5", unit: "milligram" }).success,
    ).toBe(true);
  });

  test("requires amount and unit together", () => {
    expect(routineNameSchema.safeParse({ ...validName, amount: "1" }).success).toBe(false);
    expect(routineNameSchema.safeParse({ ...validName, unit: "gram" }).success).toBe(false);
  });

  test("rejects invalid amounts and a blank name", () => {
    expect(routineNameSchema.safeParse({ ...validName, amount: "0", unit: "gram" }).success).toBe(
      false,
    );
    expect(routineNameSchema.safeParse({ ...validName, productName: "  " }).success).toBe(false);
  });
});

test("parses positive decimal amounts with either locale separator", () => {
  expect(positiveAmountSchema.parse("1.5")).toBe(1.5);
  expect(positiveAmountSchema.parse("1,5")).toBe(1.5);
  expect(positiveAmountSchema.parse(",5")).toBe(0.5);
  expect(positiveAmountSchema.parse(" 2 ")).toBe(2);
});

test("rejects zero, negative, malformed, and mixed-separator amounts", () => {
  for (const value of [
    "",
    "0",
    "0,0",
    "-1",
    "+1",
    "1,2.3",
    "1.2,3",
    "1e2",
    "NaN",
    "9".repeat(400),
  ]) {
    expect(positiveAmountSchema.safeParse(value).success).toBe(false);
  }
});

test("validates and parses amount strings with the shared schema", () => {
  expect(positiveAmountSchema.parse(" 1,5 ")).toBe(1.5);
  expect(positiveAmountSchema.safeParse("0").success).toBe(false);
});
