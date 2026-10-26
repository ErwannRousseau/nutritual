import { Column, RNHostView, TextInput } from "@expo/ui";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import ActionButton from "@/shared/ui/ActionButton";
import AppText from "@/shared/ui/AppText";
import Screen from "@/shared/ui/Screen";
import { fillAvailableWidth } from "@/shared/ui/layout";
import { usePalette } from "@/shared/ui/palette";
import { usePairingFlow } from "@/features/auth/usePairingFlow";

export default function PairScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const initialCode = Array.isArray(params.code) ? params.code[0] : params.code;

  const { codeInput, message, busy, valid, details, inspect, approve, decline } =
    usePairingFlow(initialCode);

  const colors = usePalette();

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Screen
      footer={
        <Column spacing={10}>
          <ActionButton
            label={busy ? "Checking…" : "Check code"}
            onPress={() => void inspect()}
            disabled={busy}
            kind="secondary"
          />
          <ActionButton
            label="Allow pairing"
            onPress={() => void approve()}
            disabled={busy || !valid}
          />
          <ActionButton
            label="Decline"
            onPress={() => void decline()}
            disabled={busy || !valid}
            kind="destructive"
          />
        </Column>
      }
    >
      <Column spacing={18} modifiers={fillAvailableWidth}>
        <AppText variant="largeTitle">Pair ChatGPT</AppText>
        <AppText>
          The app identified below can create routines on this phone. Routines and intakes stay
          stored locally. This authorization allows it to create future routines. Continue only if
          you recognize this app.
        </AppText>
        <TextInput
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="Pairing code"
          modifiers={fillAvailableWidth}
          style={styles.input}
          value={codeInput}
        />
        {details ? (
          <Column spacing={8}>
            <AppText variant="headline">App requesting access</AppText>
            <AppText>{`Client ID: ${details.clientId}`}</AppText>
            <AppText>{`Redirect host: ${details.redirectHost}`}</AppText>
            <AppText>{`Requested permissions: ${details.scope.join(", ")}`}</AppText>
            <AppText>{`Resource: ${details.resource ?? "None"}`}</AppText>
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

function createStyles(colors: ReturnType<typeof usePalette>) {
  return StyleSheet.create({
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
  });
}
