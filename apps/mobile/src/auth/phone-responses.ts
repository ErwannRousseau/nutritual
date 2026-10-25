import type { PairingChallengeInspectionResponse } from "@nutritual/protocol";
import { isJsonObject, type JsonValue } from "@/auth/parse";

export const phoneResponses = {
  pending: (value: JsonValue): value is PairingChallengeInspectionResponse => {
    if (!isJsonObject(value) || value.status !== "pending" || !isJsonObject(value.details)) {
      return false;
    }

    const details = value.details;
    const clientId = String(details.clientId ?? "");
    const redirectHost = String(details.redirectHost ?? "");
    const resourceValue = details.resource;
    const resource = resourceValue === null ? null : String(resourceValue ?? "");

    if (
      !clientId ||
      clientId !== details.clientId ||
      !redirectHost ||
      redirectHost !== details.redirectHost
    ) {
      return false;
    }

    if (resourceValue !== null && (!resource || resource !== resourceValue)) return false;

    if (!Array.isArray(details.scope) || details.scope.length === 0) return false;

    if (
      !details.scope.every((scope) => {
        const parsedScope = String(scope ?? "");

        return parsedScope.length > 0 && parsedScope === scope;
      })
    )
      return false;

    return resourceValue === null || resource !== "";
  },
  approved: (value: JsonValue): value is { status: "approved" } =>
    isJsonObject(value) && value.status === "approved",
  declined: (value: JsonValue): value is { status: "declined" } =>
    isJsonObject(value) && value.status === "declined",
  paired: (value: JsonValue): value is { paired: boolean } =>
    isJsonObject(value) && (value.paired === true || value.paired === false),
  disconnected: (value: JsonValue): value is { paired: false } =>
    isJsonObject(value) && value.paired === false,
  ticket: (value: JsonValue): value is { ticket: string } => {
    if (!isJsonObject(value)) return false;
    const ticket = String(value.ticket ?? "");

    return ticket.length > 0 && ticket === value.ticket;
  },
};
