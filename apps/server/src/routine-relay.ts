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
  deviceId: string;
  send: (message: string) => void;
  close: (code: number, reason: string) => void;
};

type PendingRequest = {
  userId: string;
  connectionId: string;
  operationId: string;
  finish: (result: CreateRoutineDeliveryResult) => void;
};

export function createRoutineRelay() {
  const pendingRequests = new Map<string, PendingRequest>();
  const connectedPhones = new Map<string, DeviceConnection>();

  function unconfirmed(operationId: string, message: string): CreateRoutineDeliveryResult {
    return { status: CreateRoutineDeliveryStatus.unconfirmed, operationId, message };
  }

  function finishPendingForPhone(userId: string, phoneId: string): void {
    for (const pending of pendingRequests.values()) {
      if (pending.userId === userId && pending.connectionId === phoneId) {
        pending.finish(
          unconfirmed(pending.operationId, "Phone disconnected before acknowledgment."),
        );
      }
    }
  }

  function resultMatchesRequest(result: CreateRoutineResult, operationId: string): boolean {
    return !("operationId" in result) || result.operationId === operationId;
  }

  function receivePhoneResult(
    userId: string,
    phoneId: string,
    message: CreateRoutineResultMessage,
  ): void {
    const pending = pendingRequests.get(message.requestId);

    if (
      !pending ||
      pending.userId !== userId ||
      pending.connectionId !== phoneId ||
      !resultMatchesRequest(message.result, pending.operationId)
    ) {
      return;
    }

    pending.finish(message.result);
  }

  function deliverToPhone(
    phone: DeviceConnection,
    userId: string,
    command: CreateRoutineRequest,
  ): Promise<CreateRoutineDeliveryResult> {
    const requestId = crypto.randomUUID();

    return new Promise((resolve) => {
      let timeout: ReturnType<typeof setTimeout>;

      const pending: PendingRequest = {
        userId,
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

  function connectPhone(userId: string, phone: DeviceConnection): void {
    const previousPhone = connectedPhones.get(userId);
    connectedPhones.set(userId, phone);

    if (previousPhone) {
      finishPendingForPhone(userId, previousPhone.id);
      previousPhone.close(1012, "Replaced by a new phone connection.");
    }
  }

  function disconnectPhone(userId: string, connectionId: string, closeConnection = false): void {
    const phone = connectedPhones.get(userId);

    if (phone?.id === connectionId) {
      connectedPhones.delete(userId);

      if (closeConnection) phone.close(1008, "Device disconnected.");
    }

    finishPendingForPhone(userId, connectionId);
  }

  function disconnectPairedPhone(userId: string, deviceId: string): void {
    const phone = connectedPhones.get(userId);

    if (phone?.deviceId === deviceId) disconnectPhone(userId, phone.id, true);
  }

  async function createRoutine(
    userId: string,
    command: CreateRoutineRequest,
  ): Promise<CreateRoutineDeliveryResult> {
    const phone = connectedPhones.get(userId);

    if (!phone) {
      return {
        status: CreateRoutineDeliveryStatus.unavailable,
        message: "No phone is connected.",
      };
    }

    return deliverToPhone(phone, userId, command);
  }

  return {
    connectPhone,
    disconnectPhone,
    disconnectPairedPhone,
    receivePhoneResult,
    createRoutine,
  };
}

export type RoutineRelay = ReturnType<typeof createRoutineRelay>;
