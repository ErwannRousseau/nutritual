import {
  CreateRoutineDeliveryStatus,
  CreateRoutineStatus,
  isCreateRoutineRequest,
  type CreateRoutineResult,
} from "@nutritual/protocol";
import { bodyLimit } from "hono/body-limit";
import type { Hono } from "hono";
import type { RoutineRelay } from "../routine-relay.ts";

function httpStatus(result: CreateRoutineResult): 200 | 400 | 409 | 502 {
  switch (result.status) {
    case CreateRoutineStatus.created:
    case CreateRoutineStatus.alreadyProcessed:
      return 200;
    case CreateRoutineStatus.conflict:
      return 409;
    case CreateRoutineStatus.invalid:
      return 400;
    case CreateRoutineStatus.failed:
      return 502;
  }
}

export function registerIntakeRoutineRoutes(app: Hono, relay: RoutineRelay): void {
  app.post("/intake-routines", bodyLimit({ maxSize: 8 * 1024 }), async (c) => {
    const body = await c.req.json().catch(() => null);

    if (!isCreateRoutineRequest(body)) {
      return c.json(
        {
          status: CreateRoutineStatus.invalid,
          message: "Provide a valid intake routine request.",
        },
        400,
      );
    }

    const result = await relay.createRoutine(body);

    if (result.status === CreateRoutineDeliveryStatus.unconfirmed) return c.json(result, 504);

    if (result.status === CreateRoutineDeliveryStatus.unavailable) return c.json(result, 503);

    return c.json(result, httpStatus(result));
  });
}
