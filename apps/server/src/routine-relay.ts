import {
  CreateRoutineDeliveryStatus,
  type CreateRoutineDeliveryResult,
  type CreateRoutineCommandMessage,
  type CreateRoutineRequest,
  type CreateRoutineResult,
  type CreateRoutineResultMessage,
} from "@nutritual/protocol";

const acknowledgementTimeoutMs = 10_000;

export type DeviceConnection = {
  id: string;
  send: (message: string) => void;
  close: (code: number, reason: string) => void;
};

type PendingRequest = {
  connectionId: string;
  operationId: string;
  finish: (result: CreateRoutineDeliveryResult) => void;
};

export function createRoutineRelay() {
  const pendingRequests = new Map<string, PendingRequest>();
  let connectedPhone: DeviceConnection | undefined;

  function unconfirmed(operationId: string, message: string): CreateRoutineDeliveryResult {
    return { status: CreateRoutineDeliveryStatus.unconfirmed, operationId, message };
  }

  function finishPendingForPhone(phoneId: string): void {
    for (const pending of pendingRequests.values()) {
      if (pending.connectionId === phoneId) {
        pending.finish(
          unconfirmed(pending.operationId, "Phone disconnected before acknowledgment."),
        );
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

  function deliverToPhone(
    phone: DeviceConnection,
    command: CreateRoutineRequest,
  ): Promise<CreateRoutineDeliveryResult> {
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
        const message: CreateRoutineCommandMessage = {
          type: "create_routine",
          requestId,
          command,
        };

        phone.send(JSON.stringify(message));
      } catch {
        pending.finish(
          unconfirmed(command.operationId, "Command delivery could not be confirmed."),
        );
      }
    });
  }

  function connectPhone(phone: DeviceConnection): void {
    const previousPhone = connectedPhone;
    connectedPhone = phone;

    if (previousPhone) {
      finishPendingForPhone(previousPhone.id);
      previousPhone.close(1012, "Replaced by a new phone connection.");
    }
  }

  function disconnectPhone(phoneId: string): void {
    if (connectedPhone?.id === phoneId) connectedPhone = undefined;
    finishPendingForPhone(phoneId);
  }

  async function createRoutine(
    command: CreateRoutineRequest,
  ): Promise<CreateRoutineDeliveryResult> {
    const phone = connectedPhone;

    if (!phone) {
      return {
        status: CreateRoutineDeliveryStatus.unavailable,
        message: "No phone is connected.",
      };
    }

    return deliverToPhone(phone, command);
  }

  return { connectPhone, disconnectPhone, receivePhoneResult, createRoutine };
}

export type RoutineRelay = ReturnType<typeof createRoutineRelay>;
