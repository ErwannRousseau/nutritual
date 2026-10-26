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
      message: "Code valide. Vérifiez les autorisations ci-dessous.",
    };
  } catch {
    return {
      details: null,
      message:
        "Code invalide, expiré ou associé à un autre compte. Vérifiez le compte et réessayez.",
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
      setMessage("L’application est jumelée à ce téléphone.");
    } else {
      await services.decline(code);
      setMessage("Demande refusée.");
    }

    await services.deletePendingCode();
    services.schedule(() => services.navigateToSettings(), 700);
  } catch {
    setMessage("Impossible de traiter ce jumelage. Vérifiez le code et réessayez.");
  }
}
