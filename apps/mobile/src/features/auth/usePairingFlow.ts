import { useNativeState } from "@expo/ui";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { getDeviceCredentials } from "@/features/auth/AuthProvider";
import { phoneRequest } from "@/features/auth/phone-api";
import { phoneResponses } from "@/features/auth/phone-responses";
import { normalizePairCode } from "@/features/auth/parse";
import {
  decidePairing,
  inspectPairingCode,
  pairingDecisionCode,
} from "@/features/auth/pairing-flow";

const pendingCodeKey = "nutritual.pending-pair-code";

const services = {
  inspect: async (code: string) => {
    const response = await phoneRequest(
      "/api/phone/pairing-challenges/inspect",
      { code },
      phoneResponses.pending,
    );

    return response.details;
  },
  approve: async (code: string, device: Awaited<ReturnType<typeof getDeviceCredentials>>) => {
    await phoneRequest(
      "/api/phone/pairing-challenges/approve",
      { code, ...device },
      phoneResponses.approved,
    );
  },
  decline: async (code: string) => {
    await phoneRequest("/api/phone/pairing-challenges/decline", { code }, phoneResponses.declined);
  },
  getDeviceCredentials,
  storePendingCode: (code: string) => SecureStore.setItemAsync(pendingCodeKey, code),
  deletePendingCode: () => SecureStore.deleteItemAsync(pendingCodeKey),
  schedule: (callback: () => void, delay: number) => {
    setTimeout(callback, delay);
  },
  navigateToSettings: () => router.replace("/settings"),
};

export function usePairingFlow(initialCode?: string) {
  const codeInput = useNativeState(initialCode ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [valid, setValid] = useState(false);
  const [inspectedCode, setInspectedCode] = useState<string | null>(null);
  const [details, setDetails] = useState<Awaited<ReturnType<typeof services.inspect>> | null>(null);

  useEffect(() => {
    if (initialCode) void SecureStore.setItemAsync(pendingCodeKey, initialCode);
  }, [initialCode]);

  useEffect(() => {
    if (initialCode) codeInput.set(initialCode);
  }, [initialCode, codeInput]);

  async function inspect() {
    const code = normalizePairCode(codeInput.value);

    if (!code) {
      setMessage("Saisissez le code affiché dans ChatGPT.");

      return;
    }

    setBusy(true);
    setMessage(null);
    setValid(false);
    setDetails(null);

    try {
      const result = await inspectPairingCode(code, services);

      if (result.details) {
        codeInput.set(code);
        setInspectedCode(code);
        setDetails(result.details);
        setValid(true);
      } else {
        setInspectedCode(null);
        setDetails(null);
      }

      setMessage(result.message);
    } finally {
      setBusy(false);
    }
  }

  async function decide(approve: boolean) {
    const code = pairingDecisionCode(codeInput.value, valid, inspectedCode);

    if (!code) {
      setValid(false);
      setMessage("Vérifiez à nouveau le code avant de continuer.");

      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await decidePairing(code, approve, services, setMessage);
    } finally {
      setBusy(false);
    }
  }

  return {
    codeInput,
    message,
    busy,
    valid,
    details,
    inspect,
    approve: () => decide(true),
    decline: () => decide(false),
  };
}
