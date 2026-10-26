import { useMemo, useState } from "react";
import { Column, Row, Spacer } from "@expo/ui";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet } from "react-native";
import ActionButton from "@/shared/ui/ActionButton";
import AppText from "@/shared/ui/AppText";
import { fillParent } from "@/shared/ui/layout";
import ProductBadge from "@/shared/ui/ProductBadge";
import Screen from "@/shared/ui/Screen";
import { usePalette } from "@/shared/ui/palette";
import { useRoutineDraft } from "@/features/routines/RoutineDraftProvider";
import { FrequencyKind } from "@nutritual/protocol";
import { frequencyLabel, timeLabel } from "@/features/routines/display";
import { localDate } from "@/features/routines/model";
import { useSaveRoutine } from "@/features/routines/useSaveRoutine";

export default function RoutineReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { draft, ready, missing, finish } = useRoutineDraft();

  const { busy, storeError, reload, saving, saveError, saveRoutine } = useSaveRoutine(
    id,
    draft,
    finish,
  );

  const colors = usePalette();
  const [today] = useState(() => new Date());

  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!ready || !draft) {
    return (
      <Screen>
        <AppText variant="title">{missing ? "Routine introuvable" : "Chargement…"}</AppText>
        {missing ? (
          <ActionButton label="Fermer" onPress={() => router.dismissAll()} kind="secondary" />
        ) : storeError ? (
          <>
            <AppText variant="body" color={colors.secondary}>
              {storeError}
            </AppText>
            <ActionButton label="Réessayer" onPress={() => void reload()} kind="secondary" />
          </>
        ) : null}
      </Screen>
    );
  }

  const isAsNeeded = draft.frequency.kind === FrequencyKind.asNeeded;

  return (
    <>
      <Stack.Screen options={{ title: "Vérifier" }} />
      <Screen
        footer={
          <ActionButton
            label={saving ? "Enregistrement…" : id === "new" ? "Créer la routine" : "Enregistrer"}
            onPress={() => void saveRoutine()}
            disabled={saving || busy}
            testID="routine-save"
          />
        }
      >
        <Column alignment="center" style={styles.hero}>
          <ProductBadge size={96} />
        </Column>
        <AppText variant="largeTitle">Vérifiez votre routine</AppText>
        <Column spacing={4} style={styles.summary}>
          <Row alignment="center">
            <AppText variant="subhead" color={colors.secondary}>
              Complément
            </AppText>
            <Spacer />
          </Row>
          <AppText variant="body">{draft.productName.trim()}</AppText>
        </Column>
        <Column spacing={4} style={styles.summary}>
          <Row alignment="center">
            <AppText variant="subhead" color={colors.secondary}>
              Fréquence
            </AppText>
            <Spacer />
          </Row>
          <AppText variant="body">{frequencyLabel(draft.frequency)}</AppText>
        </Column>
        {!isAsNeeded ? (
          <Column spacing={4} style={styles.summary}>
            <Row alignment="center">
              <AppText variant="subhead" color={colors.secondary}>
                Heure
              </AppText>
              <Spacer />
            </Row>
            <AppText variant="body">
              {timeLabel(new Date(`${localDate(today)}T${draft.time}:00`))}
            </AppText>
          </Column>
        ) : null}
        <AppText variant="footnote" color={colors.secondary}>
          La routine sera enregistrée. L’état du rappel sera indiqué après l’enregistrement.
        </AppText>
        {saveError ? (
          <AppText variant="footnote" textStyle={styles.error}>
            {saveError}
          </AppText>
        ) : null}
        {storeError ? (
          <AppText variant="footnote" color={colors.secondary}>
            {storeError}
          </AppText>
        ) : null}
      </Screen>
    </>
  );
}

function createStyles(colors: ReturnType<typeof usePalette>) {
  return StyleSheet.create({
    hero: { width: fillParent, paddingTop: 12 },
    summary: {
      width: fillParent,
      padding: 16,
      borderRadius: 24,
      backgroundColor: colors.grouped,
    },
    error: { color: colors.danger },
  });
}
