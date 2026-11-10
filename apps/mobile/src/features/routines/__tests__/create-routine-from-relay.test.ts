/// <reference types="bun" />

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, mock, test } from "bun:test";
import { Database, type SQLQueryBindings } from "bun:sqlite";
import {
  CreateRoutineStatus,
  FrequencyKind,
  ReminderOutcomes,
  type CreateRoutineRequest,
  type PairingDeviceRequest,
  type ReminderOutcome,
} from "@nutritual/protocol";

type TestBinding = SQLQueryBindings | SQLQueryBindings[];

type TestSqlite = {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string, ...parameters: TestBinding[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...parameters: TestBinding[]): Promise<T[]>;
  runAsync(sql: string, ...parameters: TestBinding[]): Promise<void>;
  withExclusiveTransactionAsync(
    callback: (transaction: TestSqlite) => Promise<void>,
  ): Promise<void>;
};

type ScheduleGate = {
  entered: Promise<void>;
  release(): void;
};

const directory = mkdtempSync(join(tmpdir(), "nutritual-mobile-test-"));
const databasePath = join(directory, "phone.sqlite");
let database = new Database(databasePath);
let nextId = 0;
let scheduleCalls = 0;
let scheduled = new Map<string, { identifier: string }>();
let nextScheduleGate: { entered(): void; promise: Promise<void> } | undefined;
let notificationPermission: "granted" | "denied" = "granted";
let failNextSchedule = false;

function bindings(parameters: TestBinding[]): SQLQueryBindings[] {
  const values: SQLQueryBindings[] = [];

  for (const parameter of parameters) {
    if (Array.isArray(parameter)) values.push(...parameter);
    else values.push(parameter);
  }

  return values;
}

const sqlite: TestSqlite = {
  async execAsync(sql) {
    database.exec(sql);
  },
  async getFirstAsync<T>(sql: string, ...parameters: TestBinding[]): Promise<T | null> {
    // SAFETY: The storage caller's row type matches this SELECT's columns.
    return database.query(sql).get(...bindings(parameters)) as T | null;
  },
  async getAllAsync<T>(sql: string, ...parameters: TestBinding[]): Promise<T[]> {
    // SAFETY: The storage caller's row type matches this SELECT's columns.
    return database.query(sql).all(...bindings(parameters)) as T[];
  },
  async runAsync(sql, ...parameters) {
    database.query(sql).run(...bindings(parameters));
  },
  async withExclusiveTransactionAsync(callback) {
    database.exec("BEGIN EXCLUSIVE");

    try {
      await callback(sqlite);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  },
};

mock.module("expo-sqlite", () => ({ openDatabaseAsync: async () => sqlite }));

mock.module("expo-crypto", () => ({ randomUUID: () => `test-${++nextId}` }));

mock.module("expo-notifications", () => ({
  setNotificationHandler: () => undefined,
  SchedulableTriggerInputTypes: { DAILY: "daily", WEEKLY: "weekly", CALENDAR: "calendar" },
  IosAuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2, EPHEMERAL: 3 },
  getAllScheduledNotificationsAsync: async () => [...scheduled.values()],
  cancelScheduledNotificationAsync: async (identifier: string) => {
    scheduled.delete(identifier);
  },
  getPermissionsAsync: async () => ({
    status: notificationPermission,
    ios: { status: notificationPermission === "granted" ? 1 : 0 },
  }),
  requestPermissionsAsync: async () => ({
    status: notificationPermission,
    ios: { status: notificationPermission === "granted" ? 1 : 0 },
  }),
  scheduleNotificationAsync: async (request: { identifier?: string }) => {
    scheduleCalls += 1;

    if (failNextSchedule) {
      failNextSchedule = false;
      throw new Error("Notification scheduling failed.");
    }

    const gate = nextScheduleGate;

    if (gate) {
      nextScheduleGate = undefined;
      gate.entered();
      await gate.promise;
    }

    const identifier = request.identifier ?? `scheduled-${scheduleCalls}`;
    scheduled.set(identifier, { identifier });

    return identifier;
  },
}));

afterAll(() => {
  database.close();
  rmSync(directory, { recursive: true, force: true });
});

test("relay creation deduplicates on SQLite and serializes reminder restoration", async () => {
  const { createRoutineFromRelayHandler } = await import("../create-routine-from-relay");

  const storage = await import("../storage");

  const { removeReminders, restoreReminders } = await import("../reminders");

  let latestData: Awaited<ReturnType<typeof storage.loadData>> | undefined;
  const reminderOutcomes: string[] = [];

  const makeHandler = () =>
    createRoutineFromRelayHandler({
      onData: (data) => {
        latestData = data;
      },
      onError: () => undefined,
      onReminder: (state) => {
        reminderOutcomes.push(state.status);
      },
    });

  const request: CreateRoutineRequest = {
    operationId: "operation-1",
    productName: "Magnesium",
    frequency: { kind: FrequencyKind.weekdays, days: [1] },
    time: "09:00",
  };

  let releaseSchedule!: () => void;
  let enterSchedule!: () => void;

  const scheduleGate: ScheduleGate = {
    entered: new Promise<void>((resolve) => {
      enterSchedule = resolve;
    }),
    release: () => releaseSchedule(),
  };

  const schedulePromise = new Promise<void>((resolve) => {
    releaseSchedule = resolve;
  });

  nextScheduleGate = { entered: enterSchedule, promise: schedulePromise };
  const handler = makeHandler();
  const createdPromise = handler(request);
  await scheduleGate.entered;

  const duplicatePromise = handler(request);
  const routines = (await storage.loadData()).routines;
  const restoration = restoreReminders(routines);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  scheduleGate.release();

  const [created, duplicate] = await Promise.all([createdPromise, duplicatePromise]);
  await restoration;

  expect(created.status).toBe(CreateRoutineStatus.created);

  if (created.status !== CreateRoutineStatus.created) throw new Error("Routine was not created.");

  expect(duplicate.status).toBe(CreateRoutineStatus.alreadyProcessed);
  expect((await storage.loadData()).routines).toHaveLength(1);
  expect(scheduled.size).toBe(1);

  database.close();
  database = new Database(databasePath);
  const restartedHandler = makeHandler();
  const afterRestart = await restartedHandler(request);

  expect(afterRestart.status).toBe(CreateRoutineStatus.alreadyProcessed);

  if (afterRestart.status !== CreateRoutineStatus.alreadyProcessed)
    throw new Error("Routine was not found after restart.");

  expect(afterRestart.reminder).toBe(ReminderOutcomes.scheduled);
  expect(scheduleCalls).toBe(2);

  const conflict = await restartedHandler({ ...request, productName: "Vitamine D" });
  expect(conflict.status).toBe(CreateRoutineStatus.conflict);

  const routineId = created.routineId;
  const routine = (await storage.loadData()).routines[0];

  if (!routine) throw new Error("Created routine is missing from storage.");

  await storage.saveRoutine({ ...routine, productName: "Modified Magnesium" });

  const afterEdit = await restartedHandler(request);
  expect(afterEdit.status).toBe(CreateRoutineStatus.alreadyProcessed);
  expect((await storage.loadData()).routines[0]?.productName).toBe("Modified Magnesium");
  expect(scheduleCalls).toBe(2);

  const distinct = await restartedHandler({ ...request, operationId: "operation-2" });
  expect(distinct.status).toBe(CreateRoutineStatus.created);
  expect((await storage.loadData()).routines).toHaveLength(2);

  await removeReminders(routineId);
  await storage.deleteRoutine(routineId);
  const afterDelete = await restartedHandler(request);

  expect(afterDelete.status).toBe(CreateRoutineStatus.alreadyProcessed);
  expect((await storage.loadData()).routines).toHaveLength(1);
  expect(scheduleCalls).toBe(3);

  const intervalRequest: CreateRoutineRequest = {
    operationId: "operation-interval",
    productName: "Vitamin C",
    frequency: { kind: FrequencyKind.interval, every: 2, startDate: "2026-11-04" },
    time: "08:30",
  };

  const callsBeforeInterval = scheduleCalls;
  const intervalResult = await restartedHandler(intervalRequest);

  expect(intervalResult.status).toBe(CreateRoutineStatus.created);

  if (intervalResult.status !== CreateRoutineStatus.created)
    throw new Error("Interval routine was not created.");
  expect(intervalResult.reminder).toBe(ReminderOutcomes.scheduled);
  expect(scheduleCalls).toBeGreaterThan(callsBeforeInterval);
  expect(
    (await storage.loadData()).routines.find(({ id }) => id === intervalResult.routineId),
  ).toMatchObject({
    productName: "Vitamin C",
    frequency: { kind: FrequencyKind.interval, every: 2, startDate: "2026-11-04" },
    time: "08:30",
  });

  const asNeededRequest: CreateRoutineRequest = {
    operationId: "operation-as-needed",
    productName: "Pain relief",
    frequency: { kind: FrequencyKind.asNeeded },
    time: "",
  };

  const callsBeforeAsNeeded = scheduleCalls;
  const asNeededResult = await restartedHandler(asNeededRequest);

  expect(asNeededResult.status).toBe(CreateRoutineStatus.created);

  if (asNeededResult.status !== CreateRoutineStatus.created)
    throw new Error("As-needed routine was not created.");
  expect(asNeededResult.reminder).toBe(ReminderOutcomes.none);
  expect(scheduleCalls).toBe(callsBeforeAsNeeded);
  expect(
    (await storage.loadData()).routines.find(({ id }) => id === asNeededResult.routineId),
  ).toMatchObject({
    productName: "Pain relief",
    frequency: { kind: FrequencyKind.asNeeded },
    time: "",
  });

  const callsBeforeReplay = scheduleCalls;
  const scheduledBeforeReplay = scheduled.size;

  const operationsBeforeReplay = await sqlite.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM routine_operations",
  );

  database.close();
  database = new Database(databasePath);
  const recoveredHandler = makeHandler();
  const intervalReplay = await recoveredHandler(intervalRequest);
  const asNeededReplay = await recoveredHandler(asNeededRequest);

  expect(intervalReplay).toEqual({
    status: CreateRoutineStatus.alreadyProcessed,
    operationId: intervalRequest.operationId,
    routineId: intervalResult.routineId,
    reminder: ReminderOutcomes.scheduled,
  });
  expect(asNeededReplay).toEqual({
    status: CreateRoutineStatus.alreadyProcessed,
    operationId: asNeededRequest.operationId,
    routineId: asNeededResult.routineId,
    reminder: ReminderOutcomes.none,
  });
  expect(scheduleCalls).toBe(callsBeforeReplay);
  expect(scheduled.size).toBe(scheduledBeforeReplay);
  expect((await storage.loadData()).routines).toHaveLength(3);

  async function assertReplayPreservesRoutine(
    replayRequest: CreateRoutineRequest,
    routineId: string,
    reminder: ReminderOutcome,
    modifiedName: string,
  ) {
    const conflictingRequest = {
      ...replayRequest,
      productName: `${replayRequest.productName} changed`,
    };

    expect(await recoveredHandler(conflictingRequest)).toMatchObject({
      status: CreateRoutineStatus.conflict,
      operationId: replayRequest.operationId,
    });

    const persisted = (await storage.loadData()).routines.find(({ id }) => id === routineId);

    if (!persisted) throw new Error("Routine was not found before edit.");
    await storage.saveRoutine({ ...persisted, productName: modifiedName });

    const afterEdit = await recoveredHandler(replayRequest);
    expect(afterEdit).toEqual({
      status: CreateRoutineStatus.alreadyProcessed,
      operationId: replayRequest.operationId,
      routineId,
      reminder,
    });
    expect(
      (await storage.loadData()).routines.find(({ id }) => id === routineId)?.productName,
    ).toBe(modifiedName);

    await removeReminders(routineId);
    await storage.deleteRoutine(routineId);
    expect(await recoveredHandler(replayRequest)).toEqual({
      status: CreateRoutineStatus.alreadyProcessed,
      operationId: replayRequest.operationId,
      routineId,
      reminder,
    });
    expect((await storage.loadData()).routines.some(({ id }) => id === routineId)).toBe(false);
  }

  await assertReplayPreservesRoutine(
    intervalRequest,
    intervalResult.routineId,
    ReminderOutcomes.scheduled,
    "Edited Vitamin C",
  );
  await assertReplayPreservesRoutine(
    asNeededRequest,
    asNeededResult.routineId,
    ReminderOutcomes.none,
    "Edited pain relief",
  );
  expect(scheduleCalls).toBe(callsBeforeReplay);
  expect(scheduled.size).toBe(1);
  expect((await storage.loadData()).routines).toHaveLength(1);
  expect(
    await sqlite.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM routine_operations",
    ),
  ).toEqual(operationsBeforeReplay);

  notificationPermission = "denied";
  const deniedRequest = { ...request, operationId: "operation-denied" };
  const deniedResult = await restartedHandler(deniedRequest);
  expect(deniedResult.status).toBe(CreateRoutineStatus.created);

  if (deniedResult.status !== CreateRoutineStatus.created)
    throw new Error("Routine with denied reminders was not created.");
  expect(deniedResult.reminder).toBe(ReminderOutcomes.denied);
  expect(
    await sqlite.getFirstAsync<{ reminder_outcome: string }>(
      "SELECT reminder_outcome FROM routine_operations WHERE operation_id = ?",
      deniedRequest.operationId,
    ),
  ).toEqual({ reminder_outcome: ReminderOutcomes.denied });

  notificationPermission = "granted";
  failNextSchedule = true;
  const failedRequest = { ...request, operationId: "operation-reminder-failed" };
  const failedResult = await restartedHandler(failedRequest);
  expect(failedResult.status).toBe(CreateRoutineStatus.created);

  if (failedResult.status !== CreateRoutineStatus.created)
    throw new Error("Routine with failed reminders was not created.");
  expect(failedResult.reminder).toBe(ReminderOutcomes.failed);
  expect(
    await sqlite.getFirstAsync<{ reminder_outcome: string }>(
      "SELECT reminder_outcome FROM routine_operations WHERE operation_id = ?",
      failedRequest.operationId,
    ),
  ).toEqual({ reminder_outcome: ReminderOutcomes.failed });

  database.exec(`
    CREATE TRIGGER fail_reminder_outcome_update
    BEFORE UPDATE OF reminder_outcome ON routine_operations
    BEGIN
      SELECT RAISE(ABORT, 'forced reminder outcome persistence failure');
    END;
  `);
  const unconfirmedRequest = { ...request, operationId: "operation-reminder-unconfirmed" };
  const unconfirmedResult = await restartedHandler(unconfirmedRequest);
  expect(unconfirmedResult.status).toBe(CreateRoutineStatus.created);

  if (unconfirmedResult.status !== CreateRoutineStatus.created)
    throw new Error("Routine with unconfirmed reminders was not created.");
  expect(unconfirmedResult.reminder).toBe(ReminderOutcomes.unconfirmed);
  database.exec("DROP TRIGGER fail_reminder_outcome_update");

  database.close();
  database = new Database(databasePath);
  const retryHandler = makeHandler();
  const retriedUnconfirmed = await retryHandler(unconfirmedRequest);
  expect(retriedUnconfirmed).toEqual({
    status: CreateRoutineStatus.alreadyProcessed,
    operationId: unconfirmedRequest.operationId,
    routineId: unconfirmedResult.routineId,
    reminder: ReminderOutcomes.unconfirmed,
  });
  expect((await storage.loadData()).routines).toHaveLength(4);
  expect(latestData?.routines).toHaveLength(4);
  expect(reminderOutcomes).toContain(ReminderOutcomes.none);
  expect(reminderOutcomes).toContain(ReminderOutcomes.denied);
  expect(reminderOutcomes).toContain(ReminderOutcomes.failed);
  expect(reminderOutcomes.at(-1)).toBe(ReminderOutcomes.scheduled);
});

test("device relay reconnects after the server closes its socket", async () => {
  let ticketRequests = 0;
  mock.module("expo-secure-store", () => ({
    getItemAsync: async () => null,
    setItemAsync: async () => undefined,
    deleteItemAsync: async () => undefined,
  }));
  mock.module("@/features/auth/device-credentials", () => ({
    getDeviceCredentials: async () => ({ deviceId: "phone-test", deviceSecret: "secret-test" }),
  }));
  mock.module("@/features/auth/phone-api", () => ({
    phoneRequest: async (path: string, device: PairingDeviceRequest) => {
      expect(path).toBe("/api/phone/device-ticket");
      expect(device).toEqual({ deviceId: "phone-test", deviceSecret: "secret-test" });

      return { ticket: `ticket-${++ticketRequests}` };
    },
  }));
  mock.module("@/features/auth/phone-responses", () => ({
    phoneResponses: { ticket: () => true },
  }));
  mock.module("@/features/auth/relay-url", () => ({
    deviceWebSocketUrl: (serverUrl: string, ticket: string) =>
      `${serverUrl}/device?ticket=${ticket}`,
  }));
  const { connectToDeviceRelay } = await import("../relay");

  class FakeWebSocket {
    static OPEN = 1;
    static instances: FakeWebSocket[] = [];
    sent: string[] = [];

    readyState = FakeWebSocket.OPEN;
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    url: string;

    constructor(url: string) {
      this.url = url;
      FakeWebSocket.instances.push(this);
    }

    send(message: string) {
      this.sent.push(message);
    }

    close() {
      this.readyState = 3;
    }

    drop() {
      this.readyState = 3;
      this.onclose?.();
    }
  }

  const previousWebSocket = Object.getOwnPropertyDescriptor(globalThis, "WebSocket");
  Object.defineProperty(globalThis, "WebSocket", { configurable: true, value: FakeWebSocket });
  let disconnect: (() => void) | undefined;

  try {
    FakeWebSocket.instances = [];

    disconnect = connectToDeviceRelay("http://localhost:3000", async (request) => ({
      status: CreateRoutineStatus.failed,
      operationId: request.operationId,
      message: "unused",
    }));

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const [firstSocket] = FakeWebSocket.instances;

    if (!firstSocket) throw new Error("Initial socket was not opened.");

    firstSocket.onopen?.();
    firstSocket.onmessage?.({
      data: JSON.stringify({ type: "list_routines", requestId: "list-request" }),
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(firstSocket.sent).toEqual([
      JSON.stringify({
        type: "list_routines_result",
        requestId: "list-request",
        result: {
          status: "ok",
          routines: (await (await import("../storage")).loadData()).routines,
        },
      }),
    ]);
    firstSocket.drop();
    await new Promise<void>((resolve) => setTimeout(resolve, 1_100));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(ticketRequests).toBe(2);
    expect(FakeWebSocket.instances.map((socket) => socket.url)).toEqual([
      "http://localhost:3000/device?ticket=ticket-1",
      "http://localhost:3000/device?ticket=ticket-2",
    ]);
  } finally {
    disconnect?.();

    if (previousWebSocket) Object.defineProperty(globalThis, "WebSocket", previousWebSocket);
    else Reflect.deleteProperty(globalThis, "WebSocket");
  }
});

test("listing reads current, distinct routines and reports storage failures", async () => {
  const { listRoutinesFromRelay } = await import("../list-routines-from-relay");
  const storage = await import("../storage");

  for (const routine of (await storage.loadData()).routines)
    await storage.deleteRoutine(routine.id);
  expect(await listRoutinesFromRelay()).toEqual({ status: "ok", routines: [] });

  const first = {
    id: "list-1",
    productName: "Magnesium",
    frequency: { kind: FrequencyKind.asNeeded },
    time: "",
    paused: true,
  };

  const second = {
    id: "list-2",
    productName: "Magnesium",
    frequency: { kind: FrequencyKind.weekdays, days: [1, 3] },
    time: "08:30",
    paused: false,
  };

  await storage.saveRoutine(first);
  await storage.saveRoutine(second);
  expect(await listRoutinesFromRelay()).toEqual({ status: "ok", routines: [first, second] });
  await storage.saveRoutine({ ...second, time: "09:30" });
  await storage.deleteRoutine(first.id);
  expect(await listRoutinesFromRelay()).toEqual({
    status: "ok",
    routines: [{ ...second, time: "09:30" }],
  });
  database.close();
  expect(await listRoutinesFromRelay()).toEqual({
    status: "failed",
    message: "Unable to read routines on this phone.",
  });
  database = new Database(databasePath);
});
