import type { CreateRoutineResult, DeleteRoutineResult, EditRoutineResult } from "./routine";

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

export const EditRoutineDeliveryStatus = {
  unavailable: "unavailable",
  unconfirmed: "unconfirmed",
} as const;

export type EditRoutineDeliveryResult =
  | EditRoutineResult
  | { status: typeof EditRoutineDeliveryStatus.unavailable; message: string }
  | {
      status: typeof EditRoutineDeliveryStatus.unconfirmed;
      operationId: string;
      message: string;
    };

export const DeleteRoutineDeliveryStatus = {
  unavailable: "unavailable",
  unconfirmed: "unconfirmed",
} as const;

export type DeleteRoutineDeliveryResult =
  | DeleteRoutineResult
  | { status: typeof DeleteRoutineDeliveryStatus.unavailable; message: string }
  | {
      status: typeof DeleteRoutineDeliveryStatus.unconfirmed;
      operationId: string;
      message: string;
    };
