import { Column, RNHostView } from "@expo/ui";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Text as NativeText } from "react-native";
import ActionButton from "@/shared/ui/ActionButton";
import Text from "@/shared/ui/Text";
import Screen from "@/shared/ui/Screen";
import { usePalette } from "@/shared/ui/palette";
import { getDeviceCredentials } from "@/features/auth/device-credentials";
import { useAuth } from "@/features/auth/AuthProvider";
import { phoneRequest } from "@/features/auth/phone-api";
import { phoneResponses } from "@/features/auth/phone-responses";

export default function SettingsScreen() {
  const [pairingStatus, setPairingStatus] = useState<
    "loading" | "paired" | "not-paired" | "unavailable"
  >("loading");

  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const colors = usePalette();
  const { signOut } = useAuth();
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setPairingStatus("loading");
      setMessage(null);
      void phoneRequest("/api/phone/pairing-status", undefined, phoneResponses.paired)
        .then((value) => {
          if (active) setPairingStatus(value.paired ? "paired" : "not-paired");
        })
        .catch(() => {
          if (active) {
            setPairingStatus("unavailable");
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
      setPairingStatus("not-paired");
      setMessage("ChatGPT has been disconnected.");
    } catch {
      setPairingStatus("unavailable");
      setMessage("Unable to disconnect ChatGPT.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Column spacing={18}>
        <Text variant="largeTitle">ChatGPT pairing</Text>
        <Text color={colors.secondary}>
          {pairingStatus === "loading"
            ? "Checking ChatGPT connection…"
            : pairingStatus === "paired"
              ? "ChatGPT is paired with this phone."
              : pairingStatus === "not-paired"
                ? "No phone is paired with ChatGPT."
                : "ChatGPT connection status is unavailable."}
        </Text>
        <ActionButton
          label="Enter pairing code"
          onPress={() => router.push("/pair")}
          kind="secondary"
        />
        {pairingStatus === "paired" || pairingStatus === "unavailable" ? (
          <ActionButton
            label={busy ? "Disconnecting…" : "Disconnect ChatGPT"}
            onPress={() => void disconnect()}
            disabled={busy}
            kind="destructive"
          />
        ) : null}
        {message ? (
          <RNHostView matchContents>
            <NativeText accessibilityRole="alert">{message}</NativeText>
          </RNHostView>
        ) : null}
        <ActionButton label="Sign out" onPress={() => void signOut()} kind="secondary" />
      </Column>
    </Screen>
  );
}
