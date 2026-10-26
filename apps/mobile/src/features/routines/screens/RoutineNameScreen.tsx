import { useMemo, useRef, useState } from "react";
import { Column } from "@expo/ui";
import { TextInput } from "@expo/ui";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, useWindowDimensions } from "react-native";
import ActionButton from "@/shared/ui/ActionButton";
import AppText from "@/shared/ui/AppText";
import { fillAvailableWidth, fillContainerWidth, fillParent } from "@/shared/ui/layout";
import ProductBadge from "@/shared/ui/ProductBadge";
import Screen from "@/shared/ui/Screen";
import { usePalette } from "@/shared/ui/palette";
import { useRoutineDraft } from "@/features/routines/RoutineDraftProvider";
import { useRoutineStore } from "@/features/routines/RoutinesProvider";

export default function RoutineNameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { draft, setDraft, ready, missing, markDirty } = useRoutineDraft();
  const { error, reload } = useRoutineStore();
  const colors = usePalette();
  const { fontScale } = useWindowDimensions();
  const editedName = useRef<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const styles = useMemo(() => createStyles(colors, fontScale), [colors, fontScale]);

  const continueToSchedule = () => {
    if (!draft) return;
    const nextDraft = { ...draft, productName: editedName.current ?? draft.productName };

    const errorMessage = nextDraft.productName.trim() ? null : "Supplement name is required.";

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
        <AppText variant="title">{missing ? "Routine not found" : "Loading…"}</AppText>
        {missing ? (
          <ActionButton label="Close" onPress={() => router.dismissAll()} kind="secondary" />
        ) : error ? (
          <>
            <AppText variant="body" color={colors.secondary}>
              {error}
            </AppText>
            <ActionButton label="Try again" onPress={() => void reload()} kind="secondary" />
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
          title: id === "new" ? "New routine" : "Edit routine",
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button tintColor={colors.blue} onPress={() => router.dismiss()}>
          Cancel
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Screen
        footer={
          <ActionButton
            label="Continue"
            onPress={continueToSchedule}
            testID="routine-name-continue"
          />
        }
      >
        <Column alignment="center" style={styles.hero}>
          <ProductBadge size={96} />
        </Column>
        <AppText variant="largeTitle">Which supplement?</AppText>
        <Column spacing={8} style={styles.section} modifiers={fillContainerWidth}>
          <AppText variant="headline">Supplement name</AppText>
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
            placeholder="e.g. Vitamin D"
            returnKeyType="done"
            style={styles.input}
            textStyle={styles.inputText}
            modifiers={fillAvailableWidth}
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

function createStyles(colors: ReturnType<typeof usePalette>, fontScale: number) {
  return StyleSheet.create({
    hero: { width: fillParent, paddingTop: 12 },
    section: { width: fillParent },
    input: {
      padding: 16,
      borderRadius: 28,
      backgroundColor: colors.grouped,
    },
    inputText: { color: colors.text, fontSize: 17 * fontScale },
    error: { color: colors.danger },
  });
}
