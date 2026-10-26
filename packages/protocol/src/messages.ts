import { isRecord } from "./guards";
import {
  isCreateRoutineRequest,
  isCreateRoutineResult,
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
