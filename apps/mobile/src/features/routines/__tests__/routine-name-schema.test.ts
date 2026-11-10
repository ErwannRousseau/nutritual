import { describe, expect, test } from "bun:test";
import { routineNameSchema } from "@/features/routines/routine-name-schema";

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
