import type { PairingApprovalRequest, PairingOAuthRequestDetails } from "@nutritual/protocol";
import { normalizePairCode } from "./parse";

type DeviceCredentials = Pick<PairingApprovalRequest, "deviceId" | "deviceSecret">;

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

export async function inspectPairingCode(code: string, services: PairingFlowServices) {
  try {
    const details = await services.inspect(code);
    await services.storePendingCode(code);

    return {
      details,
      message: "Code accepted. Review the permissions below.",
    };
  } catch {
    return {
      details: null,
      message:
        "The code is invalid, expired, or linked to another account. Check the account and try again.",
    };
  }
}

export async function decidePairing(
  code: string,
  approve: boolean,
  services: PairingFlowServices,
  setMessage: (message: string) => void,
): Promise<void> {
  try {
    if (approve) {
      const device = await services.getDeviceCredentials();
      await services.approve(code, device);
      setMessage("The app is paired with this phone.");
    } else {
      await services.decline(code);
      setMessage("Request declined.");
    }

    await services.deletePendingCode();
    services.schedule(() => services.navigateToSettings(), 700);
  } catch {
    setMessage("Unable to process this pairing. Check the code and try again.");
  }
}
