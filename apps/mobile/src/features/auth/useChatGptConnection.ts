import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { getDeviceCredentials } from "@/features/auth/device-credentials";
import { phoneRequest } from "@/features/auth/phone-api";
import { phoneResponses } from "@/features/auth/phone-responses";

export const PairingStatus = {
  loading: "loading",
  paired: "paired",
  notPaired: "not-paired",
  unavailable: "unavailable",
} as const;

type PairingStatus = (typeof PairingStatus)[keyof typeof PairingStatus];

export function useChatGptConnection() {
  const [pairingStatus, setPairingStatus] = useState<PairingStatus>(PairingStatus.loading);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setPairingStatus(PairingStatus.loading);
      setMessage(null);
      void phoneRequest("/api/phone/pairing-status", undefined, phoneResponses.paired)
        .then((value) => {
          if (active)
            setPairingStatus(value.paired ? PairingStatus.paired : PairingStatus.notPaired);
        })
        .catch(() => {
          if (active) {
            setPairingStatus(PairingStatus.unavailable);
            setMessage("Pairing status is unavailable.");
          }
        });

      return () => {
        active = false;
      };
    }, []),
  );

  async function disconnect() {
    setBusy(true);
    setMessage(null);

    try {
      await phoneRequest(
        "/api/phone/disconnect",
        await getDeviceCredentials(),
        phoneResponses.disconnected,
      );
      setPairingStatus(PairingStatus.notPaired);
      setMessage("ChatGPT has been disconnected.");
    } catch {
      setPairingStatus(PairingStatus.unavailable);
      setMessage("Unable to disconnect ChatGPT.");
    } finally {
      setBusy(false);
    }
  }

  return { pairingStatus, message, busy, disconnect };
}
