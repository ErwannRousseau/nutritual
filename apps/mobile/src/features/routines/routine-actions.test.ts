import { expect, test } from "bun:test";
import { FrequencyKind, type RoutineInput } from "@nutritual/protocol";
import { pauseRoutine, removeRoutine, saveRoutineDraft } from "@/features/routines/routine-actions";

const routineDraft: RoutineInput = {
  productName: "Vitamine C",
  frequency: { kind: FrequencyKind.weekdays, days: [1, 3, 5] },
  time: "08:30",
};

test("pause clears old feedback and succeeds", async () => {
  const feedback: (string | null)[] = [];
  let calls = 0;

  const paused = await pauseRoutine(
    "routine-1",
    false,
    async () => {
      calls += 1;

      return true;
    },
    (message) => feedback.push(message),
  );

  expect(paused).toBe(true);
  expect(calls).toBe(1);
  expect(feedback).toEqual([null]);
});

test("pause reports a false provider result", async () => {
  const feedback: (string | null)[] = [];

  expect(
    await pauseRoutine(
      "routine-1",
      false,
      async () => false,
      (message) => feedback.push(message),
    ),
  ).toBe(false);
  expect(feedback).toEqual([null, "Impossible de modifier la routine. Réessayez."]);
});

test("pause keeps the failure feedback when the provider rejects", async () => {
  const feedback: (string | null)[] = [];

  expect(
    await pauseRoutine(
      "routine-1",
      false,
      async () => {
        throw new Error("storage failed");
      },
      (message) => feedback.push(message),
    ),
  ).toBe(false);
  expect(feedback.at(-1)).toBe("Impossible de modifier la routine. Réessayez.");
});

test("pause does not run while the store is busy", async () => {
  let calls = 0;

  expect(
    await pauseRoutine(
      "routine-1",
      true,
      async () => {
        calls += 1;

        return true;
      },
      () => {},
    ),
  ).toBe(false);
  expect(calls).toBe(0);
});

test("remove returns success for screen navigation", async () => {
  const feedback: (string | null)[] = [];

  expect(
    await removeRoutine(
      "routine-1",
      false,
      async () => true,
      (message) => feedback.push(message),
    ),
  ).toBe(true);
  expect(feedback).toEqual([null]);
});

test("remove reports a false or rejected provider result", async () => {
  const feedback: (string | null)[] = [];

  expect(
    await removeRoutine(
      "routine-1",
      false,
      async () => false,
      (message) => feedback.push(message),
    ),
  ).toBe(false);
  expect(feedback.at(-1)).toBe("Impossible de supprimer la routine. Réessayez.");

  expect(
    await removeRoutine(
      "routine-1",
      false,
      async () => {
        throw new Error("storage failed");
      },
      (message) => feedback.push(message),
    ),
  ).toBe(false);
  expect(feedback.at(-1)).toBe("Impossible de supprimer la routine. Réessayez.");
});

test("save validates the draft before calling the store", async () => {
  const saving: boolean[] = [];
  const errors: (string | null)[] = [];
  let saves = 0;
  let finishes = 0;

  await saveRoutineDraft(
    { ...routineDraft, productName: " " },
    undefined,
    false,
    null,
    async () => {
      saves += 1;

      return true;
    },
    () => {
      finishes += 1;
    },
    (value) => saving.push(value),
    (message) => errors.push(message),
  );

  expect(errors).toEqual(["Le nom du produit est obligatoire."]);
  expect(saving).toEqual([]);
  expect(saves).toBe(0);
  expect(finishes).toBe(0);
});

test("save finishes on success and resets pending state", async () => {
  const saving: boolean[] = [];
  const errors: (string | null)[] = [];
  let finishes = 0;

  await saveRoutineDraft(
    routineDraft,
    "routine-1",
    false,
    null,
    async (_draft, id) => id === "routine-1",
    () => {
      finishes += 1;
    },
    (value) => saving.push(value),
    (message) => errors.push(message),
  );

  expect(saving).toEqual([true, false]);
  expect(errors).toEqual([null]);
  expect(finishes).toBe(1);
});

test("save reports false results and resets pending state", async () => {
  const saving: boolean[] = [];
  const errors: (string | null)[] = [];

  await saveRoutineDraft(
    routineDraft,
    undefined,
    false,
    "Store error",
    async () => false,
    () => {},
    (value) => saving.push(value),
    (message) => errors.push(message),
  );

  expect(saving).toEqual([true, false]);
  expect(errors).toEqual([null, "Store error"]);
});

test("save reports rejected operations and resets pending state", async () => {
  const saving: boolean[] = [];
  const errors: (string | null)[] = [];

  await saveRoutineDraft(
    routineDraft,
    undefined,
    false,
    null,
    async () => {
      throw new Error("disk error");
    },
    () => {},
    (value) => saving.push(value),
    (message) => errors.push(message),
  );

  expect(saving).toEqual([true, false]);
  expect(errors).toEqual([null, "disk error"]);
});
