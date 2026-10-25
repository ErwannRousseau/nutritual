import { expect, test } from "bun:test";

import { isCreateRoutineCommandMessage } from "@nutritual/protocol";
import type {
  CreateRoutineCommandMessage,
  CreateRoutineRequest,
  CreateRoutineResult,
  CreateRoutineResultMessage,
} from "@nutritual/protocol";
import serverConfig from "./index.ts";

type RunningServer = ReturnType<typeof Bun.serve>;

async function withServer(action: (server: RunningServer) => Promise<void>): Promise<void> {
  const server = Bun.serve({ ...serverConfig, hostname: "127.0.0.1", port: 0 });

  try {
    await action(server);
  } finally {
    server.stop(true);
  }
}

async function connectPhone(server: RunningServer): Promise<WebSocket> {
  const url = new URL("/device", server.url);
  url.protocol = "ws:";
  const phone = new WebSocket(url);

  await new Promise<void>((resolve, reject) => {
    phone.addEventListener("open", () => resolve(), { once: true });
    phone.addEventListener("error", () => reject(new Error("WebSocket connection failed.")), {
      once: true,
    });
  });

  return phone;
}

async function postRoutine(
  server: RunningServer,
  request: CreateRoutineRequest,
): Promise<Response> {
  return fetch(new URL("/intake-routines", server.url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
}

async function nextCommand(phone: WebSocket): Promise<CreateRoutineCommandMessage> {
  return new Promise((resolve, reject) => {
    phone.addEventListener(
      "message",
      (event) => {
        const command = parseCommand(String(event.data));

        if (command) resolve(command);
        else reject(new Error("Server sent an invalid command."));
      },
      { once: true },
    );
  });
}

function parseCommand(value: string): CreateRoutineCommandMessage | undefined {
  try {
    const parsed: unknown = JSON.parse(value);

    return isCreateRoutineCommandMessage(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

const request: CreateRoutineRequest = {
  operationId: "6aa886cc-0c3d-4e16-b667-183d238a2f01",
  productName: "Magnesium",
  frequency: { kind: "as-needed" },
  time: "",
};

test("GET /health keeps its successful health response", async () => {
  await withServer(async (server) => {
    const response = await fetch(new URL("/health", server.url));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});

test("POST /intake-routines rejects invalid routine input before delivery", async () => {
  await withServer(async (server) => {
    const response = await fetch(new URL("/intake-routines", server.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...request, frequency: { kind: "daily" } }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ status: "invalid" });
  });
});

test("POST /intake-routines reports an unavailable phone without queuing", async () => {
  await withServer(async (server) => {
    const response = await postRoutine(server, request);

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: "unavailable" });
  });
});

test("POST /intake-routines returns the actual phone outcome", async () => {
  await withServer(async (server) => {
    const phone = await connectPhone(server);

    const result: CreateRoutineResult = {
      status: "created",
      operationId: request.operationId,
      routineId: "ca01665e-0c87-4978-baf4-792a5a37f58f",
      reminder: "none",
    };

    const acknowledgement = new Promise<CreateRoutineResultMessage>((resolve, reject) => {
      phone.addEventListener(
        "message",
        (event) => {
          try {
            const command = JSON.parse(String(event.data));

            if (!isCreateRoutineCommandMessage(command)) {
              reject(new Error("Server sent an invalid command."));

              return;
            }

            expect(command.type).toBe("create_routine");
            expect(command.command).toEqual(request);
            resolve({
              type: "create_routine_result",
              requestId: command.requestId,
              result,
            });
          } catch (error) {
            reject(error);
          }
        },
        { once: true },
      );
    });

    const responsePromise = postRoutine(server, request);
    phone.send(JSON.stringify(await acknowledgement));
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    phone.close();
  });
});

test("POST /intake-routines forwards every supported frequency unchanged", async () => {
  await withServer(async (server) => {
    const phone = await connectPhone(server);

    const requests: CreateRoutineRequest[] = [
      {
        ...request,
        operationId: "weekdays-operation",
        productName: "Vitamin D",
        frequency: { kind: "weekdays", days: [1, 3, 5] },
        time: "08:30",
      },
      {
        ...request,
        operationId: "interval-operation",
        productName: "Magnesium",
        frequency: { kind: "interval", every: 3, startDate: "2026-10-25" },
        time: "09:00",
      },
      {
        ...request,
        operationId: "as-needed-operation",
        productName: "Zinc",
        frequency: { kind: "as-needed" },
        time: "",
      },
    ];

    for (const routine of requests) {
      const responsePromise = postRoutine(server, routine);
      const command = await nextCommand(phone);

      expect(command.command).toEqual(routine);
      phone.send(
        JSON.stringify({
          type: "create_routine_result",
          requestId: command.requestId,
          result: {
            status: "created",
            operationId: routine.operationId,
            routineId: "created-routine-id",
            reminder: routine.frequency.kind === "as-needed" ? "none" : "denied",
          },
        }),
      );

      const response = await responsePromise;

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        status: "created",
        operationId: routine.operationId,
      });
    }

    phone.close();
  });
});

test("POST /intake-routines maps duplicate, conflict, and definite phone failure outcomes", async () => {
  const cases: Array<{ result: CreateRoutineResult; expectedStatus: number }> = [
    {
      result: {
        status: "already_processed",
        operationId: request.operationId,
        routineId: "ca01665e-0c87-4978-baf4-792a5a37f58f",
        reminder: "none",
      },
      expectedStatus: 200,
    },
    {
      result: { status: "conflict", operationId: request.operationId, message: "Conflict." },
      expectedStatus: 409,
    },
    {
      result: { status: "failed", operationId: request.operationId, message: "Storage failed." },
      expectedStatus: 502,
    },
  ];

  for (const { result, expectedStatus } of cases) {
    await withServer(async (server) => {
      const phone = await connectPhone(server);
      const responsePromise = postRoutine(server, request);
      const command = await nextCommand(phone);

      phone.send(
        JSON.stringify({ type: "create_routine_result", requestId: command.requestId, result }),
      );

      const response = await responsePromise;

      expect(response.status).toBe(expectedStatus);
      expect(await response.json()).toEqual(result);
      phone.close();
    });
  }
});

test("POST /intake-routines reports a lost acknowledgement as unconfirmed after a bounded wait", async () => {
  await withServer(async (server) => {
    const phone = await connectPhone(server);
    const response = await postRoutine(server, request);

    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({
      status: "unconfirmed",
      operationId: request.operationId,
    });
    phone.close();
  });
}, 15_000);
