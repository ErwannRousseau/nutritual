import { useRef, useState } from "react";
import { Column } from "@expo/ui";
import { TextInput } from "@expo/ui";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, useWindowDimensions } from "react-native";
import { ActionButton, AppText, ProductBadge, Screen, usePalette } from "../../../components/ui";
import { useRoutineDraft } from "../../../components/routine-form/RoutineDraftProvider";
import { useRoutineStore } from "../../../routines/RoutinesProvider";

export default function RoutineNameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { draft, setDraft, ready, missing, markDirty } = useRoutineDraft();
  const { error, reload } = useRoutineStore();
  const colors = usePalette();
  const { fontScale } = useWindowDimensions();
  const editedName = useRef<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const styles = StyleSheet.create({
    hero: { width: "100%" as const, paddingTop: 12 },
    section: { width: "100%" as const },
    input: {
      width: "100%" as const,
      padding: 16,
      borderRadius: 28,
      backgroundColor: colors.grouped,
    },
    inputText: { color: colors.text, fontSize: 17 * fontScale },
    error: { color: colors.danger },
  });

  const continueToSchedule = () => {
    if (!draft) return;
    const nextDraft = { ...draft, productName: editedName.current ?? draft.productName };

    const errorMessage = nextDraft.productName.trim()
      ? null
      : "Le nom du complément est obligatoire.";

    if (errorMessage) {
      setValidationError(errorMessage);

      return;
    }

    setDraft(nextDraft);
    router.push(`/routine/${id}/schedule`);
  };

  if (!ready || !draft) {
    return (
      <Screen>
        <AppText variant="title">{missing ? "Routine introuvable" : "Chargement…"}</AppText>
        {missing ? (
          <ActionButton label="Fermer" onPress={() => router.dismissAll()} kind="secondary" />
        ) : error ? (
          <>
            <AppText variant="body" color={colors.secondary}>
              {error}
            </AppText>
            <ActionButton label="Réessayer" onPress={() => void reload()} kind="secondary" />
          </>
        ) : null}
      </Screen>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: id === "new" ? "Nouvelle routine" : "Modifier la routine",
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button tintColor={colors.blue} onPress={() => router.dismiss()}>
          Annuler
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Screen
        footer={
          <ActionButton
            label="Continuer"
            onPress={continueToSchedule}
            testID="routine-name-continue"
          />
        }
      >
        <Column alignment="center" style={styles.hero}>
          <ProductBadge size={96} />
        </Column>
        <AppText variant="largeTitle">Quel complément ?</AppText>
        <Column spacing={8} style={styles.section}>
          <AppText variant="headline">Nom du complément</AppText>
          <TextInput
            selectTextOnFocus
            autoCapitalize="sentences"
            autoCorrect={false}
            defaultValue={draft.productName}
            maxLength={120}
            onChangeText={(value) => {
              editedName.current = value;
              markDirty();
              setValidationError(null);
            }}
            placeholder="Ex. Vitamine D"
            returnKeyType="done"
            style={styles.input}
            textStyle={styles.inputText}
            testID="product-name"
          />
          {validationError ? (
            <AppText variant="footnote" textStyle={styles.error}>
              {validationError}
            </AppText>
          ) : null}
          {error ? (
            <AppText variant="footnote" color={colors.danger}>
              {error}
            </AppText>
          ) : null}
        </Column>
      </Screen>
    </>
  );
}
