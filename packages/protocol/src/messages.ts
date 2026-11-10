import { isRecord } from "./guards";
import {
  isListRoutinesResult,
  type ListRoutinesResult,
  isCreateRoutineRequest,
  isCreateRoutineResult,
  isEditRoutineRequest,
  isEditRoutineResult,
  type EditRoutineRequest,
  type EditRoutineResult,
  type CreateRoutineRequest,
  type CreateRoutineResult,
} from "./routine";

export type CreateRoutineCommandMessage = {
  type: "create_routine";
  requestId: string;
  command: CreateRoutineRequest;
};

export type CreateRoutineResultMessage = {
  type: "create_routine_result";
  requestId: string;
  result: CreateRoutineResult;
};

export function isCreateRoutineCommandMessage(
  value: unknown,
): value is CreateRoutineCommandMessage {
  return (
    isRecord(value) &&
    value.type === "create_routine" &&
    typeof value.requestId === "string" &&
    !!value.requestId &&
    isCreateRoutineRequest(value.command)
  );
}

export function isCreateRoutineResultMessage(value: unknown): value is CreateRoutineResultMessage {
  return (
    isRecord(value) &&
    value.type === "create_routine_result" &&
    typeof value.requestId === "string" &&
    !!value.requestId &&
    isCreateRoutineResult(value.result)
  );
}

export type EditRoutineCommandMessage = {
  type: "edit_routine";
  requestId: string;
  command: EditRoutineRequest;
};

export type EditRoutineResultMessage = {
  type: "edit_routine_result";
  requestId: string;
  result: EditRoutineResult;
};

export function isEditRoutineCommandMessage(value: unknown): value is EditRoutineCommandMessage {
  return (
    isRecord(value) &&
    value.type === "edit_routine" &&
    typeof value.requestId === "string" &&
    !!value.requestId &&
    isEditRoutineRequest(value.command)
  );
}

export function isEditRoutineResultMessage(value: unknown): value is EditRoutineResultMessage {
  return (
    isRecord(value) &&
    value.type === "edit_routine_result" &&
    typeof value.requestId === "string" &&
    !!value.requestId &&
    isEditRoutineResult(value.result)
  );
}

export type ListRoutinesCommandMessage = { type: "list_routines"; requestId: string };

export type ListRoutinesResultMessage = {
  type: "list_routines_result";
  requestId: string;
  result: ListRoutinesResult;
};

export function isListRoutinesCommandMessage(value: unknown): value is ListRoutinesCommandMessage {
  return (
    isRecord(value) &&
    value.type === "list_routines" &&
    typeof value.requestId === "string" &&
    !!value.requestId
  );
}

export function isListRoutinesResultMessage(value: unknown): value is ListRoutinesResultMessage {
  return (
    isRecord(value) &&
    value.type === "list_routines_result" &&
    typeof value.requestId === "string" &&
    !!value.requestId &&
    isListRoutinesResult(value.result)
  );
}
