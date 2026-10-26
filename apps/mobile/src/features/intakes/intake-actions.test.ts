import { expect, test } from "bun:test";
import { recordIntakeAction, undoIntakeAction } from "@/features/intakes/intake-actions";

test("record skips unselected and disabled actions", async () => {
  const saving: boolean[] = [];
  const feedback: (string | null)[] = [];
  let calls = 0;

  const record = async () => {
    calls += 1;

    return true;
  };

  expect(
    await recordIntakeAction(
      "routine-1",
      false,
      false,
      record,
      (value) => saving.push(value),
      (value) => feedback.push(value),
    ),
  ).toBe(false);
  expect(
    await recordIntakeAction(
      "routine-1",
      true,
      true,
      record,
      (value) => saving.push(value),
      (value) => feedback.push(value),
    ),
  ).toBe(false);
  expect(calls).toBe(0);
  expect(saving).toEqual([]);
  expect(feedback).toEqual([]);
});

test("record succeeds and resets pending state", async () => {
  const saving: boolean[] = [];
  const feedback: (string | null)[] = [];
  const recordedIds: string[] = [];

  expect(
    await recordIntakeAction(
      "routine-1",
      true,
      false,
      async (id) => {
        recordedIds.push(id);

        return true;
      },
      (value) => saving.push(value),
      (value) => feedback.push(value),
    ),
  ).toBe(true);
  expect(recordedIds).toEqual(["routine-1"]);
  expect(saving).toEqual([true, false]);
  expect(feedback).toEqual([null]);
});

test("record reports false and rejected operations", async () => {
  const saving: boolean[] = [];
  const feedback: (string | null)[] = [];

  expect(
    await recordIntakeAction(
      "routine-1",
      true,
      false,
      async () => false,
      (value) => saving.push(value),
      (value) => feedback.push(value),
    ),
  ).toBe(false);
  expect(saving).toEqual([true, false]);
  expect(feedback.at(-1)).toBe("Impossible d’enregistrer la prise. Réessayez.");

  expect(
    await recordIntakeAction(
      "routine-1",
      true,
      false,
      async () => {
        throw new Error("storage failed");
      },
      (value) => saving.push(value),
      (value) => feedback.push(value),
    ),
  ).toBe(false);
  expect(saving.slice(-2)).toEqual([true, false]);
  expect(feedback.at(-1)).toBe("Impossible d’enregistrer la prise. Réessayez.");
});

test("undo succeeds and resets pending state", async () => {
  const undoing: boolean[] = [];
  const feedback: (string | null)[] = [];
  const undoneIds: string[] = [];

  expect(
    await undoIntakeAction(
      "intake-1",
      false,
      async (id) => {
        undoneIds.push(id);

        return true;
      },
      (value) => undoing.push(value),
      (value) => feedback.push(value),
    ),
  ).toBe(true);
  expect(undoneIds).toEqual(["intake-1"]);
  expect(undoing).toEqual([true, false]);
  expect(feedback).toEqual([null]);
});

test("undo reports false and rejected operations and resets pending state", async () => {
  const undoing: boolean[] = [];
  const feedback: (string | null)[] = [];

  expect(
    await undoIntakeAction(
      "intake-1",
      false,
      async () => false,
      (value) => undoing.push(value),
      (value) => feedback.push(value),
    ),
  ).toBe(false);
  expect(undoing).toEqual([true, false]);
  expect(feedback.at(-1)).toBe("Impossible d’annuler cette prise. Réessayez.");

  expect(
    await undoIntakeAction(
      "intake-1",
      false,
      async () => {
        throw new Error("storage failed");
      },
      (value) => undoing.push(value),
      (value) => feedback.push(value),
    ),
  ).toBe(false);
  expect(undoing.slice(-2)).toEqual([true, false]);
  expect(feedback.at(-1)).toBe("Impossible d’annuler cette prise. Réessayez.");
});
