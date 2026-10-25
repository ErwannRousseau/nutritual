import { Column, RNHostView } from "@expo/ui";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Text } from "react-native";
import ActionButton from "@/components/ui/ActionButton";
import AppText from "@/components/ui/AppText";
import Screen from "@/components/ui/Screen";
import { usePalette } from "@/components/ui/palette";
import { getDeviceCredentials, useAuth } from "@/auth/AuthProvider";
import { phoneRequest, phoneResponses } from "@/auth/phone-api";

export default function SettingsScreen() {
  const [paired, setPaired] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const colors = usePalette();
  const { signOut } = useAuth();
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void phoneRequest("/api/phone/pairing-status", undefined, phoneResponses.paired)
        .then((value) => {
          if (active) setPaired(value.paired);
        })
        .catch(() => {
          if (active) setMessage("État du jumelage indisponible.");
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
      setPaired(false);
      setMessage("ChatGPT a été déconnecté.");
    } catch {
      setMessage("Impossible de déconnecter ChatGPT.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Column spacing={18}>
        <AppText variant="largeTitle">Jumelage ChatGPT</AppText>
        <AppText color={colors.secondary}>
          {paired
            ? "ChatGPT est jumelé à ce téléphone."
            : "Aucun téléphone n’est jumelé à ChatGPT."}
        </AppText>
        <ActionButton
          label="Saisir un code de jumelage"
          onPress={() => router.push("/pair")}
          kind="secondary"
        />
        {paired ? (
          <ActionButton
            label={busy ? "Déconnexion…" : "Déconnecter ChatGPT"}
            onPress={() => void disconnect()}
            disabled={busy}
            kind="destructive"
          />
        ) : null}
        {message ? (
          <RNHostView matchContents>
            <Text accessibilityRole="alert">{message}</Text>
          </RNHostView>
        ) : null}
        <ActionButton label="Se déconnecter" onPress={() => void signOut()} kind="secondary" />
      </Column>
    </Screen>
  );
}
