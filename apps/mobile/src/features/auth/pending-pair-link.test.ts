import { expect, test } from "bun:test";
import { createPendingPairLinkCoordinator } from "./pending-pair-link";

test("a newer QR link replaces the launch link and survives sign-in", async () => {
  const storedCodes: string[] = [];
  const navigations: Array<[string, boolean]> = [];
  let authenticated = false;

  const coordinator = createPendingPairLinkCoordinator(
    async (code) => {
      storedCodes.push(code);
    },
    () => ({ ready: true, authenticated }),
    (code, isAuthenticated) => navigations.push([code, isAuthenticated]),
  );

  await coordinator.handleInitialUrl("nutritual:/pair?code=AAAA-AAAA");
  await coordinator.handleUrl("nutritual:/pair?code=BBBB-BBBB");
  authenticated = true;

  expect(await coordinator.handleInitialUrl("nutritual:/pair?code=AAAA-AAAA")).toBe(false);

  expect(await coordinator.readPendingCode(async () => storedCodes.at(-1) ?? null)).toBe(
    "BBBB-BBBB",
  );
  expect(storedCodes).toEqual(["AAAA-AAAA", "BBBB-BBBB"]);
  expect(navigations).toEqual([
    ["AAAA-AAAA", false],
    ["BBBB-BBBB", false],
  ]);
});

test("a runtime QR event wins over a late initial URL and stale pending-code read", async () => {
  let storedCode: string | null = "AAAA-AAAA";
  const readStarted = deferred<void>();
  const staleRead = deferred<string | null>();

  const coordinator = createPendingPairLinkCoordinator(
    async (code) => {
      storedCode = code;
    },
    () => ({ ready: true, authenticated: false }),
    () => {},
  );

  const read = coordinator.readPendingCode(() => {
    readStarted.resolve();

    return staleRead.promise;
  });

  await readStarted.promise;
  await coordinator.handleUrl("nutritual:/pair?code=BBBB-BBBB");
  expect(await coordinator.handleInitialUrl("nutritual:/pair?code=AAAA-AAAA")).toBe(false);
  staleRead.resolve("AAAA-AAAA");

  expect(await read).toBeNull();
  expect(storedCode).toBe("BBBB-BBBB");
});

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}
