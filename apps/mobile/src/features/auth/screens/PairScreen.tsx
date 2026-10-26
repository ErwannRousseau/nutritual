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
            label={busy ? "Vérification…" : "Vérifier le code"}
            onPress={() => void inspect()}
            disabled={busy}
            kind="secondary"
          />
          <ActionButton
            label="Autoriser le jumelage"
            onPress={() => void approve()}
            disabled={busy || !valid}
          />
          <ActionButton
            label="Refuser"
            onPress={() => void decline()}
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
