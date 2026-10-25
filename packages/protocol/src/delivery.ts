import type { CreateRoutineResult } from "./routine";

export const CreateRoutineDeliveryStatus = {
  unavailable: "unavailable",
  unconfirmed: "unconfirmed",
} as const;

export type CreateRoutineDeliveryResult =
  | CreateRoutineResult
  | { status: typeof CreateRoutineDeliveryStatus.unavailable; message: string }
  | {
      status: typeof CreateRoutineDeliveryStatus.unconfirmed;
      operationId: string;
      message: string;
    };
