import { getUsableTokens } from "@/features/auth/session";
import type {
  PairingApprovalRequest,
  PairingCodeRequest,
  PairingDeviceRequest,
} from "@nutritual/protocol";
import type { JsonValue } from "@/features/auth/parse";

const base = process.env.EXPO_PUBLIC_SERVER_URL?.replace(/\/$/, "");

type PhoneRequestBody = PairingCodeRequest | PairingApprovalRequest | PairingDeviceRequest;

export async function phoneRequest<T extends JsonValue>(
  path: string,
  body: PhoneRequestBody | undefined,
  responseGuard: (value: JsonValue) => value is T,
): Promise<T> {
  if (!base) throw new Error("The server is not configured.");
  const tokens = await getUsableTokens();

  if (!tokens) throw new Error("Sign in again to continue.");

  const authorization = `Bearer ${tokens.accessToken}`;

  const request: RequestInit =
    body === undefined
      ? { method: "GET", headers: { authorization } }
      : {
          method: "POST",
          headers: { authorization, "content-type": "application/json" },
          body: JSON.stringify(body),
        };

  const response = await fetch(`${base}${path}`, request);

  if (!response.ok) throw new Error("The request failed.");

  const result: JsonValue = await response.json();

  if (!responseGuard(result)) throw new Error("Invalid server response.");

  return result;
}
