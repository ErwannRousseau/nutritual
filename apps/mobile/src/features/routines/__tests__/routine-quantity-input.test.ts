import { expect, test } from "bun:test";
import { parsePositiveAmount } from "../routine-quantity-input";

test("parses positive decimal amounts with either locale separator", () => {
  expect(parsePositiveAmount("1.5")).toBe(1.5);
  expect(parsePositiveAmount("1,5")).toBe(1.5);
  expect(parsePositiveAmount(",5")).toBe(0.5);
  expect(parsePositiveAmount(" 2 ")).toBe(2);
});

test("rejects zero, negative, malformed, and mixed-separator amounts", () => {
  for (const value of ["", "0", "0,0", "-1", "+1", "1,2.3", "1.2,3", "1e2", "NaN"]) {
    expect(parsePositiveAmount(value)).toBeNull();
  }
});
