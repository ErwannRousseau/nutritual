import type { PairingApprovalRequest, PairingOAuthRequestDetails } from "@nutritual/protocol";
import { normalizePairCode } from "./parse";

type DeviceCredentials = Pick<PairingApprovalRequest, "deviceId" | "deviceSecret">;

export type PairingNotice = {
  tone: "success" | "info" | "error";
  text: string;
};

export type PairingFlowServices = {
  inspect: (code: string) => Promise<PairingOAuthRequestDetails>;
  approve: (code: string, device: DeviceCredentials) => Promise<void>;
  decline: (code: string) => Promise<void>;
  getDeviceCredentials: () => Promise<DeviceCredentials>;
  storePendingCode: (code: string) => Promise<void>;
  deletePendingCode: () => Promise<void>;
  schedule: (callback: () => void, delay: number) => void;
  navigateToSettings: () => void;
};

export function pairingDecisionCode(
  input: string,
  valid: boolean,
  inspectedCode: string | null,
): string | null {
  const code = normalizePairCode(input);

  return code && valid && code === inspectedCode ? code : null;
}

export async function inspectPairingCode(
  code: string,
  services: PairingFlowServices,
): Promise<{ details: PairingOAuthRequestDetails | null; notice: PairingNotice }> {
  try {
    const details = await services.inspect(code);
    await services.storePendingCode(code);

    return {
      details,
      notice: { tone: "success", text: "Code accepted. Review the permissions below." },
    };
  } catch {
    return {
      details: null,
      notice: {
        tone: "error",
        text: "The code is invalid, expired, or linked to another account. Check the account and try again.",
      },
    };
  }
}

export async function decidePairing(
  code: string,
  approve: boolean,
  services: PairingFlowServices,
): Promise<PairingNotice> {
  try {
    if (approve) {
      const device = await services.getDeviceCredentials();
      await services.approve(code, device);
    } else {
      await services.decline(code);
    }

    await services.deletePendingCode();
    services.schedule(() => services.navigateToSettings(), 700);
  } catch {
    return { tone: "error", text: "Unable to process this pairing. Check the code and try again." };
  }

  if (approve) return { tone: "success", text: "The app is paired with this phone." };

  return { tone: "info", text: "Request declined." };
}
