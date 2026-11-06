import { expect, test } from "bun:test";
import { createActionQueue } from "../action-queue";

test("waits for loading and earlier work, then continues after a failure", async () => {
  const busy: boolean[] = [];
  const steps: string[] = [];
  const queue = createActionQueue((value) => busy.push(value));
  let release!: () => void;

  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const first = queue.run(async () => {
    steps.push("first");
    await gate;
    throw new Error("failed");
  });

  const firstResult = first.catch((error: Error) => error.message);

  const second = queue.run(async () => {
    steps.push("second");

    return "done";
  });

  await Promise.resolve();
  expect(steps).toEqual([]);
  expect(queue.isBusy()).toBe(true);
  queue.finishLoading();
  await Promise.resolve();
  expect(steps).toEqual(["first"]);
  release();
  expect(await firstResult).toBe("failed");
  expect(await second).toBe("done");
  expect(steps).toEqual(["first", "second"]);
  expect(queue.isBusy()).toBe(false);
  expect(busy.at(-1)).toBe(false);
});
