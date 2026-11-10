/// <reference types="bun" />

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, mock, test } from "bun:test";
import { Database, type SQLQueryBindings } from "bun:sqlite";
import {
  CreateRoutineStatus,
  DeleteRoutineStatus,
  EditRoutineStatus,
  FrequencyKind,
  ReminderOutcomes,
  type CreateRoutineRequest,
  type PairingDeviceRequest,
  type ReminderOutcome,
} from "@nutritual/protocol";
import { createActionQueue } from "../action-queue";

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
let transactionTail = Promise.resolve();
let nextId = 0;
let scheduleCalls = 0;
let cancelCalls = 0;
let scheduled = new Map<string, { identifier: string }>();

const scheduledRequests: {
  trigger?: { type?: string; weekday?: number; hour?: number; minute?: number };
}[] = [];

let nextScheduleGate: { entered(): void; promise: Promise<void> } | undefined;
let notificationPermission: "granted" | "denied" = "granted";
let failNextSchedule = false;
let failNextCancel = false;

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
    const previous = transactionTail;
    let release!: () => void;
    transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    database.exec("BEGIN EXCLUSIVE");

    try {
      await callback(sqlite);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    } finally {
      release();
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
    cancelCalls += 1;

    if (failNextCancel) {
      failNextCancel = false;
      throw new Error("Notification cancellation failed.");
    }

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
  scheduleNotificationAsync: async (request: {
    identifier?: string;
    trigger?: { type?: string; weekday?: number; hour?: number; minute?: number };
  }) => {
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
    scheduledRequests.push({ trigger: request.trigger });

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
  const queue = createActionQueue(() => undefined);
  queue.finishLoading();

  const makeHandler = () =>
    createRoutineFromRelayHandler({
      serialize: queue.run,
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
  const { EXPO_PUBLIC_SERVER_URL } = await import("@/env");

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

    disconnect = connectToDeviceRelay(
      async (request) => ({
        status: CreateRoutineStatus.failed,
        operationId: request.operationId,
        message: "unused",
      }),
      async (request) => {
        if (request.operationId === "edit-error") throw new Error("storage error");

        return {
          status: EditRoutineStatus.failed,
          operationId: request.operationId,
          message: "unused",
        };
      },
      async (request) => ({
        status: DeleteRoutineStatus.failed,
        operationId: request.operationId,
        message: "unused",
      }),
    );

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
    firstSocket.onmessage?.({ data: "not json" });
    firstSocket.onmessage?.({ data: JSON.stringify({ type: "create_routine", requestId: "bad" }) });
    firstSocket.onmessage?.({
      data: JSON.stringify({
        type: "create_routine",
        requestId: "create-request",
        command: {
          operationId: "create-op",
          productName: "Magnesium",
          frequency: { kind: FrequencyKind.asNeeded },
          time: "",
        },
      }),
    });
    firstSocket.onmessage?.({
      data: JSON.stringify({
        type: "edit_routine",
        requestId: "error-request",
        command: {
          operationId: "edit-error",
          expected: {
            id: "routine-id",
            productName: "Magnesium",
            frequency: { kind: FrequencyKind.asNeeded },
            time: "",
            paused: false,
          },
          changes: { productName: "Zinc" },
        },
      }),
    });
    firstSocket.onmessage?.({
      data: JSON.stringify({
        type: "delete_routine",
        requestId: "delete-request",
        command: {
          operationId: "delete-op",
          expected: {
            id: "routine-id",
            productName: "Magnesium",
            frequency: { kind: FrequencyKind.asNeeded },
            time: "",
            paused: false,
          },
        },
      }),
    });
    firstSocket.onmessage?.({
      data: JSON.stringify({
        type: "edit_routine",
        requestId: "edit-request",
        command: {
          operationId: "edit-op",
          expected: {
            id: "routine-id",
            productName: "Magnesium",
            frequency: { kind: FrequencyKind.asNeeded },
            time: "",
            paused: false,
          },
          changes: { productName: "Zinc" },
        },
      }),
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(
      firstSocket.sent
        .slice(1)
        .map((value) => JSON.parse(value))
        .sort((a, b) => a.requestId.localeCompare(b.requestId)),
    ).toEqual([
      {
        type: "create_routine_result",
        requestId: "create-request",
        result: { status: CreateRoutineStatus.failed, operationId: "create-op", message: "unused" },
      },
      {
        type: "delete_routine_result",
        requestId: "delete-request",
        result: {
          status: DeleteRoutineStatus.failed,
          operationId: "delete-op",
          message: "unused",
        },
      },
      {
        type: "edit_routine_result",
        requestId: "edit-request",
        result: { status: EditRoutineStatus.failed, operationId: "edit-op", message: "unused" },
      },
      {
        type: "edit_routine_result",
        requestId: "error-request",
        result: {
          status: EditRoutineStatus.failed,
          operationId: "edit-error",
          message: "Unable to save the routine on this phone.",
        },
      },
    ]);
    firstSocket.drop();
    await new Promise<void>((resolve) => setTimeout(resolve, 1_100));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(ticketRequests).toBe(2);
    expect(FakeWebSocket.instances.map((socket) => socket.url)).toEqual([
      `${EXPO_PUBLIC_SERVER_URL}/device?ticket=ticket-1`,
      `${EXPO_PUBLIC_SERVER_URL}/device?ticket=ticket-2`,
    ]);
  } finally {
    disconnect?.();

    if (previousWebSocket) Object.defineProperty(globalThis, "WebSocket", previousWebSocket);
    else Reflect.deleteProperty(globalThis, "WebSocket");
  }
});

test("relay deletion compares snapshots, preserves intake history, and retries reminder cleanup", async () => {
  const { deleteRoutineFromRelayHandler } = await import("../delete-routine-from-relay");
  const storage = await import("../storage");
  const queue = createActionQueue(() => undefined);
  queue.finishLoading();
  const deletedIds: string[] = [];

  const handler = deleteRoutineFromRelayHandler({
    serialize: queue.run,
    onData: () => undefined,
    onError: () => undefined,
    onDeleted: (id) => deletedIds.push(id),
  });

  const missing = {
    operationId: "delete-missing-op",
    expected: {
      id: "relay-delete-missing",
      productName: "Not saved",
      frequency: { kind: FrequencyKind.asNeeded },
      time: "",
      paused: false,
    },
  };

  expect(await handler(missing)).toEqual({
    status: DeleteRoutineStatus.notFound,
    operationId: missing.operationId,
    message: "The routine no longer exists on this phone.",
  });

  const routine = {
    id: "relay-delete-history",
    productName: "Magnesium",
    frequency: { kind: FrequencyKind.weekdays, days: [1] },
    time: "09:00",
    paused: false,
  };

  await storage.saveRoutine(routine);
  await storage.saveIntake({
    id: "intake-preserved-after-delete",
    routineId: routine.id,
    productName: routine.productName,
    recordedAt: "2026-11-10T08:00:00.000Z",
  });
  const reminderId = `nutritual:${routine.id}:weekday-1`;
  scheduled.set(reminderId, { identifier: reminderId });
  failNextCancel = true;

  const request = { operationId: "delete-history-op", expected: routine };
  expect(await handler(request)).toEqual({
    status: DeleteRoutineStatus.deleted,
    operationId: request.operationId,
    routineId: routine.id,
    reminder: ReminderOutcomes.failed,
  });
  expect((await storage.loadData()).routines).not.toContainEqual(routine);
  expect((await storage.loadData()).intakes).toContainEqual({
    id: "intake-preserved-after-delete",
    routineId: routine.id,
    productName: routine.productName,
    recordedAt: "2026-11-10T08:00:00.000Z",
  });
  expect(scheduled.has(reminderId)).toBe(true);
  expect(
    await sqlite.getFirstAsync<{ reminder_outcome: string }>(
      "SELECT reminder_outcome FROM routine_operations WHERE operation_id = ?",
      request.operationId,
    ),
  ).toEqual({ reminder_outcome: ReminderOutcomes.failed });

  expect(await handler(request)).toEqual({
    status: DeleteRoutineStatus.alreadyProcessed,
    operationId: request.operationId,
    routineId: routine.id,
    reminder: ReminderOutcomes.none,
  });
  expect(scheduled.has(reminderId)).toBe(false);
  expect(deletedIds).toEqual([routine.id]);

  const recreated = { ...routine, productName: "New magnesium routine" };
  await storage.saveRoutine(recreated);
  await storage.saveRoutine({ ...routine, id: "unrelated-routine", productName: "Zinc" });
  expect(await handler(request)).toEqual({
    status: DeleteRoutineStatus.alreadyProcessed,
    operationId: request.operationId,
    routineId: routine.id,
    reminder: ReminderOutcomes.none,
  });
  expect((await storage.loadData()).routines).toContainEqual(recreated);
  expect((await storage.loadData()).routines).toContainEqual({
    ...routine,
    id: "unrelated-routine",
    productName: "Zinc",
  });
  expect((await storage.loadData()).intakes).toContainEqual({
    id: "intake-preserved-after-delete",
    routineId: routine.id,
    productName: routine.productName,
    recordedAt: "2026-11-10T08:00:00.000Z",
  });
  expect(deletedIds).toEqual([routine.id]);

  expect(await handler({ ...request, expected: { ...routine, time: "10:00" } })).toMatchObject({
    status: DeleteRoutineStatus.conflict,
    operationId: request.operationId,
  });

  const stale = { ...routine, id: "relay-delete-stale" };
  await storage.saveRoutine(stale);
  await storage.saveRoutine({ ...stale, productName: "Changed" });
  expect(await handler({ operationId: "delete-stale-op", expected: stale })).toMatchObject({
    status: DeleteRoutineStatus.conflict,
  });
  expect((await storage.loadData()).routines.find(({ id }) => id === stale.id)?.productName).toBe(
    "Changed",
  );

  const concurrent = { ...routine, id: "relay-delete-concurrent", productName: "Vitamin D" };
  await storage.saveRoutine(concurrent);
  await storage.saveIntake({
    id: "intake-concurrent-delete",
    routineId: concurrent.id,
    productName: concurrent.productName,
    recordedAt: "2026-11-10T08:30:00.000Z",
  });

  const concurrentRequest = { operationId: "delete-concurrent-op", expected: concurrent };

  const concurrentResults = await Promise.all([
    handler(concurrentRequest),
    handler(concurrentRequest),
  ]);

  expect(concurrentResults.map(({ status }) => status).sort()).toEqual([
    DeleteRoutineStatus.alreadyProcessed,
    DeleteRoutineStatus.deleted,
  ]);
  expect((await storage.loadData()).routines.some(({ id }) => id === concurrent.id)).toBe(false);
  expect((await storage.loadData()).intakes).toContainEqual({
    id: "intake-concurrent-delete",
    routineId: concurrent.id,
    productName: concurrent.productName,
    recordedAt: "2026-11-10T08:30:00.000Z",
  });
});

test("relay edits compare snapshots, preserve paused state, and never replay after later changes", async () => {
  const { editRoutineFromRelayHandler } = await import("../edit-routine-from-relay");
  const storage = await import("../storage");

  const original = {
    id: "relay-edit-paused",
    productName: "Magnesium",
    frequency: { kind: FrequencyKind.weekdays, days: [1, 3] },
    time: "09:00",
    paused: true,
  };

  await storage.saveRoutine(original);

  const reminderStates: string[] = [];
  const queue = createActionQueue(() => undefined);
  queue.finishLoading();

  const handler = editRoutineFromRelayHandler({
    serialize: queue.run,
    onData: () => undefined,
    onError: () => undefined,
    onReminder: ({ status }) => reminderStates.push(status),
  });

  const request = {
    operationId: "edit-paused-op",
    expected: original,
    changes: { productName: "Updated magnesium" },
  };

  expect(await handler(request)).toEqual({
    status: "updated",
    operationId: request.operationId,
    routineId: original.id,
    reminder: ReminderOutcomes.none,
  });
  expect((await storage.loadData()).routines).toContainEqual({
    ...original,
    productName: "Updated magnesium",
  });
  expect(reminderStates).toEqual(["paused"]);

  const updated = (await storage.loadData()).routines.find(({ id }) => id === original.id);

  if (!updated) throw new Error("Updated routine is missing.");
  await storage.saveRoutine({ ...updated, productName: "Changed later" });
  expect(await handler(request)).toEqual({
    status: "already_processed",
    operationId: request.operationId,
    routineId: original.id,
    reminder: ReminderOutcomes.none,
  });
  expect(
    (await storage.loadData()).routines.find(({ id }) => id === original.id)?.productName,
  ).toBe("Changed later");

  await storage.deleteRoutine(original.id);
  expect(await handler(request)).toMatchObject({ status: "already_processed" });
  expect((await storage.loadData()).routines.some(({ id }) => id === original.id)).toBe(false);

  const staleRoutine = { ...original, id: "relay-edit-stale", paused: false };
  await storage.saveRoutine(staleRoutine);
  await storage.saveRoutine({ ...staleRoutine, time: "10:00" });
  expect(
    await handler({
      operationId: "edit-stale-op",
      expected: staleRoutine,
      changes: { productName: "Should not apply" },
    }),
  ).toMatchObject({ status: "conflict", operationId: "edit-stale-op" });
  expect((await storage.loadData()).routines.find(({ id }) => id === staleRoutine.id)?.time).toBe(
    "10:00",
  );

  const createRequest: CreateRoutineRequest = {
    operationId: "shared-operation-id",
    productName: "Created by create",
    frequency: { kind: FrequencyKind.asNeeded },
    time: "",
  };

  const { createRoutineOperation } = await import("../operations/create");
  await createRoutineOperation(createRequest, {
    id: "relay-edit-id-collision",
    productName: createRequest.productName,
    frequency: createRequest.frequency,
    time: createRequest.time,
    paused: false,
  });
  expect(
    await handler({
      operationId: createRequest.operationId,
      expected: staleRoutine,
      changes: { productName: "Operation ID collision" },
    }),
  ).toMatchObject({ status: "conflict", operationId: createRequest.operationId });

  const concurrentRoutine = { ...original, id: "relay-edit-concurrent", paused: false };
  await storage.saveRoutine(concurrentRoutine);

  const concurrentResults = await Promise.all([
    handler({
      operationId: "edit-concurrent-a",
      expected: concurrentRoutine,
      changes: { productName: "Concurrent A" },
    }),
    handler({
      operationId: "edit-concurrent-b",
      expected: concurrentRoutine,
      changes: { time: "10:00" },
    }),
  ]);

  expect(concurrentResults.map(({ status }) => status).sort()).toEqual(["conflict", "updated"]);
  expect(
    (await storage.loadData()).routines.find(({ id }) => id === concurrentRoutine.id),
  ).not.toEqual(concurrentRoutine);
});

test("paused-only relay edits are unchanged and stay no-ops on retry", async () => {
  const { editRoutineFromRelayHandler } = await import("../edit-routine-from-relay");
  const storage = await import("../storage");

  const routine = {
    id: "relay-paused-only",
    productName: "Magnesium",
    frequency: { kind: FrequencyKind.weekdays, days: [1] },
    time: "09:00",
    paused: false,
  };

  await storage.saveRoutine(routine);
  scheduled.set("nutritual:relay-paused-only:weekday-1", {
    identifier: "nutritual:relay-paused-only:weekday-1",
  });

  const queue = createActionQueue(() => undefined);
  queue.finishLoading();
  const reminderStates: string[] = [];
  let dataUpdates = 0;

  const handler = editRoutineFromRelayHandler({
    serialize: queue.run,
    onData: () => dataUpdates++,
    onError: () => undefined,
    onReminder: ({ status }) => reminderStates.push(status),
  });

  const request = {
    operationId: "pause-only-op",
    expected: routine,
    changes: { paused: false },
  };

  const initialScheduleCalls = scheduleCalls;
  const initialCancelCalls = cancelCalls;

  expect(await handler(request)).toEqual({
    status: EditRoutineStatus.unchanged,
    operationId: request.operationId,
    routineId: routine.id,
    reminder: ReminderOutcomes.unconfirmed,
  });
  expect((await storage.loadData()).routines.find(({ id }) => id === routine.id)).toEqual(routine);
  expect(scheduleCalls).toBe(initialScheduleCalls);
  expect(cancelCalls).toBe(initialCancelCalls);
  expect(scheduled.has("nutritual:relay-paused-only:weekday-1")).toBe(true);
  expect(reminderStates).toEqual([]);
  expect(dataUpdates).toBe(0);

  await storage.saveRoutine({ ...routine, productName: "Changed later" });
  expect(await handler(request)).toEqual({
    status: EditRoutineStatus.unchanged,
    operationId: request.operationId,
    routineId: routine.id,
    reminder: ReminderOutcomes.unconfirmed,
  });
  expect((await storage.loadData()).routines.find(({ id }) => id === routine.id)?.productName).toBe(
    "Changed later",
  );
  expect(scheduleCalls).toBe(initialScheduleCalls);
  expect(cancelCalls).toBe(initialCancelCalls);

  const paused = { ...routine, id: "relay-resume-only", paused: true };
  await storage.saveRoutine(paused);

  const resumeRequest = {
    operationId: "resume-only-op",
    expected: paused,
    changes: { paused: true },
  };

  expect(await handler(resumeRequest)).toEqual({
    status: EditRoutineStatus.unchanged,
    operationId: resumeRequest.operationId,
    routineId: paused.id,
    reminder: ReminderOutcomes.unconfirmed,
  });
  expect((await storage.loadData()).routines.find(({ id }) => id === paused.id)).toEqual(paused);
  expect(scheduleCalls).toBe(initialScheduleCalls);
  expect(cancelCalls).toBe(initialCancelCalls);
});

test("pause and resume edits preserve reminder failure handling and cancellation", async () => {
  const { editRoutineFromRelayHandler } = await import("../edit-routine-from-relay");
  const storage = await import("../storage");

  const routine = {
    id: "relay-pause-with-time",
    productName: "Magnesium",
    frequency: { kind: FrequencyKind.weekdays, days: [1] },
    time: "09:00",
    paused: false,
  };

  await storage.saveRoutine(routine);
  const identifier = "nutritual:relay-pause-with-time:weekday-1";
  scheduled.set(identifier, { identifier });

  const queue = createActionQueue(() => undefined);
  queue.finishLoading();

  const handler = editRoutineFromRelayHandler({
    serialize: queue.run,
    onData: () => undefined,
    onError: () => undefined,
    onReminder: () => undefined,
  });

  const initialScheduleCalls = scheduleCalls;

  const pause = await handler({
    operationId: "pause-with-time-op",
    expected: routine,
    changes: { paused: true },
  });

  expect(pause).toMatchObject({
    status: EditRoutineStatus.updated,
    reminder: ReminderOutcomes.none,
  });
  expect(scheduled.has(identifier)).toBe(false);
  expect(scheduleCalls).toBe(initialScheduleCalls);

  const paused = (await storage.loadData()).routines.find(({ id }) => id === routine.id);

  if (!paused) throw new Error("Paused routine is missing.");
  notificationPermission = "denied";

  const deniedResume = await handler({
    operationId: "resume-denied-op",
    expected: paused,
    changes: { paused: false },
  });

  expect(deniedResume).toMatchObject({
    status: EditRoutineStatus.updated,
    reminder: ReminderOutcomes.denied,
  });
  expect((await storage.loadData()).routines.find(({ id }) => id === routine.id)).toMatchObject({
    paused: false,
    time: "09:00",
  });
  expect(scheduleCalls).toBe(initialScheduleCalls);

  notificationPermission = "granted";
  failNextSchedule = true;
  const afterDeniedResume = (await storage.loadData()).routines.find(({ id }) => id === routine.id);

  if (!afterDeniedResume) throw new Error("Resumed routine is missing.");

  const schedulingFailure = await handler({
    operationId: "schedule-failed-op",
    expected: afterDeniedResume,
    changes: { time: "12:00" },
  });

  expect(schedulingFailure).toMatchObject({
    status: EditRoutineStatus.updated,
    reminder: ReminderOutcomes.failed,
  });

  const afterFailure = (await storage.loadData()).routines.find(({ id }) => id === routine.id);

  if (!afterFailure) throw new Error("Routine after the scheduling failure is missing.");

  const successfulResume = await handler({
    operationId: "schedule-retry-op",
    expected: afterFailure,
    changes: { time: "13:00" },
  });

  expect(successfulResume).toMatchObject({
    status: EditRoutineStatus.updated,
    reminder: ReminderOutcomes.scheduled,
  });
  expect(scheduleCalls).toBeGreaterThan(initialScheduleCalls);

  const cancelRoutine = { ...routine, id: "relay-pause-cancel-failure" };
  await storage.saveRoutine(cancelRoutine);
  const cancelIdentifier = "nutritual:relay-pause-cancel-failure:weekday-1";
  scheduled.set(cancelIdentifier, { identifier: cancelIdentifier });
  failNextCancel = true;

  const cancelFailure = await handler({
    operationId: "pause-cancel-failed-op",
    expected: cancelRoutine,
    changes: { paused: true },
  });

  expect(cancelFailure).toMatchObject({
    status: EditRoutineStatus.updated,
    reminder: ReminderOutcomes.failed,
  });
  expect(
    (await storage.loadData()).routines.find(({ id }) => id === cancelRoutine.id),
  ).toMatchObject({
    paused: true,
    time: "09:00",
  });
  expect(scheduled.has(cancelIdentifier)).toBe(true);
});

test("resuming a routine schedules its preserved weekly schedule without catch-up reminders", async () => {
  const { editRoutineFromRelayHandler } = await import("../edit-routine-from-relay");
  const storage = await import("../storage");

  const paused = {
    id: "relay-resume-preserved-schedule",
    productName: "Magnesium",
    frequency: { kind: FrequencyKind.weekdays, days: [1, 3] },
    time: "09:00",
    paused: true,
  };

  await storage.saveRoutine(paused);

  const queue = createActionQueue(() => undefined);
  queue.finishLoading();

  const handler = editRoutineFromRelayHandler({
    serialize: queue.run,
    onData: () => undefined,
    onError: () => undefined,
    onReminder: () => undefined,
  });

  const firstNewSchedule = scheduledRequests.length;

  expect(
    await handler({
      operationId: "resume-preserved-schedule-op",
      expected: paused,
      changes: { paused: false },
    }),
  ).toMatchObject({ status: EditRoutineStatus.updated, reminder: ReminderOutcomes.scheduled });

  expect((await storage.loadData()).routines.find(({ id }) => id === paused.id)).toEqual({
    ...paused,
    paused: false,
  });
  expect(scheduledRequests.slice(firstNewSchedule).map(({ trigger }) => trigger)).toEqual([
    { type: "weekly", weekday: 2, hour: 9, minute: 0 },
    { type: "weekly", weekday: 4, hour: 9, minute: 0 },
  ]);
});

test("creation and editing wait for each other through the shared action queue", async () => {
  const { createRoutineFromRelayHandler } = await import("../create-routine-from-relay");
  const { editRoutineFromRelayHandler } = await import("../edit-routine-from-relay");
  const storage = await import("../storage");
  const queue = createActionQueue(() => undefined);
  queue.finishLoading();

  const callbacks = {
    serialize: queue.run,
    onData: () => undefined,
    onError: () => undefined,
    onReminder: () => undefined,
  };

  const create = createRoutineFromRelayHandler(callbacks);
  const edit = editRoutineFromRelayHandler(callbacks);

  const routine = {
    id: "queue-edit",
    productName: "Before",
    frequency: { kind: FrequencyKind.asNeeded },
    time: "",
    paused: false,
  };

  await storage.saveRoutine(routine);

  let entered!: () => void;
  let release!: () => void;

  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });

  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  nextScheduleGate = { entered, promise: gate };

  const creation = create({
    operationId: "queue-create-op",
    productName: "Queued creation",
    frequency: { kind: FrequencyKind.weekdays, days: [1] },
    time: "09:00",
  });

  await started;

  const editing = edit({
    operationId: "queue-edit-op",
    expected: routine,
    changes: { productName: "After" },
  });

  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect((await storage.loadData()).routines.find(({ id }) => id === routine.id)).toEqual(routine);
  release();
  expect((await creation).status).toBe(CreateRoutineStatus.created);
  expect((await editing).status).toBe(EditRoutineStatus.updated);
  expect((await storage.loadData()).routines.find(({ id }) => id === routine.id)?.productName).toBe(
    "After",
  );
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
