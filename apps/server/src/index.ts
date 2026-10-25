import { upgradeWebSocket, websocket } from "@hono/bun";
import {
  createRoutineStatus,
  isCreateRoutineRequest,
  isCreateRoutineResultMessage,
  type CreateRoutineRequest,
  type CreateRoutineResult,
  type CreateRoutineResultMessage,
} from "@nutritual/protocol";
import { bodyLimit } from "hono/body-limit";
import { Hono } from "hono";

const acknowledgementTimeoutMs = 10_000;

type UnavailableResult = { status: "unavailable"; message: string };

type UnconfirmedResult = {
  status: "unconfirmed";
  operationId: string;
  message: string;
};

type HttpResult = CreateRoutineResult | UnavailableResult | UnconfirmedResult;

type ConnectedPhone = {
  id: string;
  send: (message: string) => void;
  close: (code: number, reason: string) => void;
};

type PendingRequest = {
  connectionId: string;
  operationId: string;
  finish: (result: HttpResult) => void;
};

const pendingRequests = new Map<string, PendingRequest>();
let connectedPhone: ConnectedPhone | undefined;

function unconfirmed(operationId: string, message: string): UnconfirmedResult {
  return { status: "unconfirmed", operationId, message };
}

function finishPendingForPhone(phoneId: string): void {
  for (const pending of pendingRequests.values()) {
    if (pending.connectionId === phoneId) {
      pending.finish(unconfirmed(pending.operationId, "Phone disconnected before acknowledgment."));
    }
  }
}

function resultMatchesRequest(result: CreateRoutineResult, operationId: string): boolean {
  return !("operationId" in result) || result.operationId === operationId;
}

function receivePhoneResult(phoneId: string, message: CreateRoutineResultMessage): void {
  const pending = pendingRequests.get(message.requestId);

  if (
    !pending ||
    pending.connectionId !== phoneId ||
    !resultMatchesRequest(message.result, pending.operationId)
  ) {
    return;
  }

  pending.finish(message.result);
}

function deliverToPhone(phone: ConnectedPhone, command: CreateRoutineRequest): Promise<HttpResult> {
  const requestId = crypto.randomUUID();

  return new Promise((resolve) => {
    let timeout: ReturnType<typeof setTimeout>;

    const pending: PendingRequest = {
      connectionId: phone.id,
      operationId: command.operationId,
      finish: (result) => {
        if (!pendingRequests.delete(requestId)) return;
        clearTimeout(timeout);
        resolve(result);
      },
    };

    timeout = setTimeout(() => {
      pending.finish(
        unconfirmed(command.operationId, "No phone acknowledgment within 10 seconds."),
      );
    }, acknowledgementTimeoutMs);

    pendingRequests.set(requestId, pending);

    try {
      phone.send(
        JSON.stringify({
          type: "create_routine",
          requestId,
          command,
        }),
      );
    } catch {
      pending.finish(unconfirmed(command.operationId, "Command delivery could not be confirmed."));
    }
  });
}

function httpStatus(result: CreateRoutineResult): 200 | 400 | 409 | 502 {
  switch (result.status) {
    case createRoutineStatus.created:
    case createRoutineStatus.alreadyProcessed:
      return 200;
    case createRoutineStatus.conflict:
      return 409;
    case createRoutineStatus.invalid:
      return 400;
    case createRoutineStatus.failed:
      return 502;
  }
}

export const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.get(
  "/device",
  upgradeWebSocket(() => {
    const phoneId = crypto.randomUUID();

    return {
      onOpen(_event, ws) {
        const previousPhone = connectedPhone;

        const phone: ConnectedPhone = {
          id: phoneId,
          send: (message) => ws.send(message),
          close: (code, reason) => ws.close(code, reason),
        };

        connectedPhone = phone;

        if (previousPhone) {
          finishPendingForPhone(previousPhone.id);
          previousPhone.close(1012, "Replaced by a new phone connection.");
        }
      },
      onMessage(event) {
        let value: unknown;

        try {
          value = JSON.parse(String(event.data));
        } catch {
          return;
        }

        if (isCreateRoutineResultMessage(value)) receivePhoneResult(phoneId, value);
      },
      onClose() {
        if (connectedPhone?.id === phoneId) connectedPhone = undefined;
        finishPendingForPhone(phoneId);
      },
      onError() {
        if (connectedPhone?.id === phoneId) connectedPhone = undefined;
        finishPendingForPhone(phoneId);
      },
    };
  }),
);

app.post("/intake-routines", bodyLimit({ maxSize: 8 * 1024 }), async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!isCreateRoutineRequest(body)) {
    return c.json(
      { status: "invalid" as const, message: "Provide a valid intake routine request." },
      400,
    );
  }

  const phone = connectedPhone;

  if (!phone) {
    return c.json({ status: "unavailable" as const, message: "No phone is connected." }, 503);
  }

  const result = await deliverToPhone(phone, body);

  if (result.status === "unconfirmed" || result.status === "unavailable") {
    return c.json(result, result.status === "unconfirmed" ? 504 : 503);
  }

  return c.json(result, httpStatus(result));
});

export const serverConfig = {
  hostname: "0.0.0.0",
  port: Number(Bun.env.PORT ?? 3000),
  fetch: app.fetch,
  websocket,
};

export default serverConfig;
