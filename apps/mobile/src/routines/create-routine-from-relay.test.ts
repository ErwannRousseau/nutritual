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
  getPermissionsAsync: async () => ({ status: "granted", ios: { status: 1 } }),
  requestPermissionsAsync: async () => ({ status: "granted", ios: { status: 1 } }),
  scheduleNotificationAsync: async (request: { identifier?: string }) => {
    scheduleCalls += 1;
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
  const { createRoutineFromRelayHandler } = await import("./create-routine-from-relay");

  const storage = await import("./storage");

  const { removeReminders, restoreReminders } = await import("./reminders");

  const makeHandler = () =>
    createRoutineFromRelayHandler({
      onData: () => undefined,
      onError: () => undefined,
      onReminder: () => undefined,
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
});

test("device relay reconnects after the server closes its socket", async () => {
  let ticketRequests = 0;
  mock.module("expo-secure-store", () => ({
    getItemAsync: async () => null,
    setItemAsync: async () => undefined,
    deleteItemAsync: async () => undefined,
  }));
  mock.module("@/auth/AuthProvider", () => ({
    getDeviceCredentials: async () => ({ deviceId: "phone-test", deviceSecret: "secret-test" }),
  }));
  mock.module("@/auth/phone-api", () => ({
    phoneResponses: { ticket: () => true },
    phoneRequest: async () => ({ ticket: `ticket-${++ticketRequests}` }),
    deviceWebSocketUrl: (serverUrl: string, ticket: string) =>
      `${serverUrl}/device?ticket=${ticket}`,
  }));
  const { connectToDeviceRelay } = await import("./relay");

  class FakeWebSocket {
    static OPEN = 1;
    static instances: FakeWebSocket[] = [];

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

    send(_message: string) {}

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
