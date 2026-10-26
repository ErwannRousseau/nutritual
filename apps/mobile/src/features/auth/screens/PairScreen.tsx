import { Column, RNHostView, TextInput, useNativeState } from "@expo/ui";
import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";
import * as SecureStore from "expo-secure-store";
import ActionButton from "@/shared/ui/ActionButton";
import AppText from "@/shared/ui/AppText";
import Screen from "@/shared/ui/Screen";
import { fillAvailableWidth } from "@/shared/ui/layout";
import { usePalette } from "@/shared/ui/palette";
import { getDeviceCredentials } from "@/features/auth/AuthProvider";
import { phoneRequest } from "@/features/auth/phone-api";
import { phoneResponses } from "@/features/auth/phone-responses";
import { normalizePairCode } from "@/features/auth/parse";
import type { PairingOAuthRequestDetails } from "@nutritual/protocol";

export default function PairScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const initialCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const codeInput = useNativeState(initialCode ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [valid, setValid] = useState(false);
  const [inspectedCode, setInspectedCode] = useState<string | null>(null);
  const [details, setDetails] = useState<PairingOAuthRequestDetails | null>(null);
  const colors = usePalette();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        input: {
          backgroundColor: colors.grouped,
          borderColor: colors.separator,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          color: colors.text,
          fontSize: 18,
          height: 58,
          paddingHorizontal: 14,
        },
        error: { color: colors.danger, fontSize: 16 },
      }),
    [colors],
  );

  useEffect(() => {
    if (initialCode) void SecureStore.setItemAsync("nutritual.pending-pair-code", initialCode);
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
      const inspection = await phoneRequest(
        "/api/phone/pairing-challenges/inspect",
        { code },
        phoneResponses.pending,
      );

      await SecureStore.setItemAsync("nutritual.pending-pair-code", code);
      codeInput.set(code);
      setInspectedCode(code);
      setDetails(inspection.details);
      setValid(true);
      setMessage("Code valide. Vérifiez les autorisations ci-dessous.");
    } catch {
      setValid(false);
      setInspectedCode(null);
      setDetails(null);
      setMessage(
        "Code invalide, expiré ou associé à un autre compte. Vérifiez le compte et réessayez.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function decide(approve: boolean) {
    const code = normalizePairCode(codeInput.value);

    if (!code || !valid || code !== inspectedCode) {
      setValid(false);
      setMessage("Vérifiez à nouveau le code avant de continuer.");

      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      if (approve) {
        const device = await getDeviceCredentials();
        await phoneRequest(
          "/api/phone/pairing-challenges/approve",
          { code, ...device },
          phoneResponses.approved,
        );
        setMessage("L’application est jumelée à ce téléphone.");
      } else {
        await phoneRequest(
          "/api/phone/pairing-challenges/decline",
          { code },
          phoneResponses.declined,
        );
        setMessage("Demande refusée.");
      }

      await SecureStore.deleteItemAsync("nutritual.pending-pair-code");
      setTimeout(() => router.replace("/settings"), 700);
    } catch {
      setMessage("Impossible de traiter ce jumelage. Vérifiez le code et réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      footer={
        <Column spacing={10}>
          <ActionButton
            label={busy ? "Vérification…" : "Vérifier le code"}
            onPress={() => void inspect()}
            disabled={busy}
            kind="secondary"
          />
          <ActionButton
            label="Autoriser le jumelage"
            onPress={() => void decide(true)}
            disabled={busy || !valid}
          />
          <ActionButton
            label="Refuser"
            onPress={() => void decide(false)}
            disabled={busy || !valid}
            kind="destructive"
          />
        </Column>
      }
    >
      <Column spacing={18} modifiers={fillAvailableWidth}>
        <AppText variant="largeTitle">Jumeler ChatGPT</AppText>
        <AppText>
          L’application identifiée ci-dessous pourra créer des routines sur ce téléphone. Les
          routines et prises restent stockées localement. Une seule autorisation suffit pour créer
          les routines suivantes. Ne continuez que si vous reconnaissez cette application.
        </AppText>
        <TextInput
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="Code de jumelage"
          modifiers={fillAvailableWidth}
          style={styles.input}
          value={codeInput}
        />
        {details ? (
          <Column spacing={8}>
            <AppText variant="headline">Application à autoriser</AppText>
            <AppText>{`Identifiant client : ${details.clientId}`}</AppText>
            <AppText>{`Hôte de redirection : ${details.redirectHost}`}</AppText>
            <AppText>{`Autorisations demandées : ${details.scope.join(", ")}`}</AppText>
            <AppText>{`Ressource : ${details.resource ?? "Aucune"}`}</AppText>
          </Column>
        ) : null}
        {message ? (
          <RNHostView matchContents>
            <Text accessibilityRole="alert" style={styles.error}>
              {message}
            </Text>
          </RNHostView>
        ) : null}
      </Column>
    </Screen>
  );
}
