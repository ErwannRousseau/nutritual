import { Column, Row, Spacer } from "@expo/ui";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import ActionRow from "@/components/routine-detail/ActionRow";
import {
  AppText,
  centerAvailableWidth,
  fillParent,
  ProductBadge,
  Screen,
  usePalette,
} from "@/components/ui";
import { frequencyLabel, reminderLabel, timeLabel } from "@/routines/display";
import { useRoutineStore } from "@/routines/RoutinesProvider";
import { frequencyKind } from "@nutritual/protocol";

export default function RoutineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { routines, reminders, busy, error, pause, remove } = useRoutineStore();
  const colors = usePalette();
  const [feedback, setFeedback] = useState<string | null>(null);
  const routine = routines.find((item) => item.id === id);
  const reminder = reminders.find((item) => item.routineId === id);
  const errorMessage = feedback ?? error;

  const schedule = routine
    ? routine.frequency.kind === frequencyKind.asNeeded
      ? frequencyLabel(routine.frequency)
      : `${timeLabel(new Date(`2000-01-01T${routine.time}:00`))} · ${frequencyLabel(routine.frequency)}`
    : "";

  const styles = useMemo(() => createStyles(colors), [colors]);

  async function togglePause() {
    if (!routine || busy) return;
    setFeedback(null);

    try {
      if (!(await pause(routine.id))) setFeedback("Impossible de modifier la routine. Réessayez.");
    } catch {
      setFeedback("Impossible de modifier la routine. Réessayez.");
    }
  }

  async function deleteRoutine() {
    if (!routine || busy) return;
    setFeedback(null);

    try {
      if (await remove(routine.id)) router.back();
      else setFeedback("Impossible de supprimer la routine. Réessayez.");
    } catch {
      setFeedback("Impossible de supprimer la routine. Réessayez.");
    }
  }

  function confirmDelete() {
    if (!routine) return;
    Alert.alert(
      "Supprimer cette routine ?",
      `${routine.productName} ne figurera plus dans votre planning.`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: () => void deleteRoutine() },
      ],
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Complément", headerShown: true }} />
      {!routine ? (
        <Screen grouped>
          <AppText color={error ? colors.danger : colors.text}>
            {busy ? "Chargement de la routine…" : (error ?? "Routine introuvable.")}
          </AppText>
        </Screen>
      ) : (
        <Screen grouped>
          <Row alignment="center">
            <Column alignment="center" spacing={12} style={styles.content}>
              <ProductBadge size={96} />
              <AppText
                modifiers={centerAvailableWidth}
                variant="largeTitle"
                textStyle={styles.centeredText}
              >
                {routine.productName}
              </AppText>
              <AppText
                color={colors.secondary}
                modifiers={centerAvailableWidth}
                textStyle={styles.centeredText}
              >
                {routine.paused ? "En pause" : schedule}
              </AppText>
            </Column>
            <Spacer />
          </Row>
          <Row alignment="center">
            <Column spacing={12} style={styles.card}>
              <Row alignment="center">
                <Column spacing={4}>
                  <AppText variant="footnote" color={colors.secondary}>
                    Rythme
                  </AppText>
                  <AppText variant="subhead">{schedule}</AppText>
                </Column>
                <Spacer />
              </Row>
              <Row alignment="center">
                <Column spacing={4}>
                  <AppText variant="footnote" color={colors.secondary}>
                    Rappel
                  </AppText>
                  <AppText variant="subhead">{reminderLabel(reminder)}</AppText>
                </Column>
                <Spacer />
              </Row>
            </Column>
            <Spacer />
          </Row>
          {errorMessage ? (
            <AppText variant="subhead" color={colors.danger}>
              {errorMessage}
            </AppText>
          ) : null}
          <AppText variant="footnote" color={colors.secondary}>
            GESTION
          </AppText>
          <Row alignment="center">
            <Column spacing={0} style={styles.card}>
              <ActionRow
                label="Modifier"
                icon="ellipsis"
                disabled={busy}
                onPress={() => router.push(`/routine/${routine.id}`)}
              />
              <Column style={styles.separator} />
              <ActionRow
                label="Enregistrer une prise"
                icon="checkmark"
                disabled={busy}
                onPress={() => router.push(`/record/${routine.id}`)}
              />
              <Column style={styles.separator} />
              <ActionRow
                label={routine.paused ? "Reprendre la routine" : "Mettre en pause"}
                icon="pause"
                disabled={busy}
                onPress={() => void togglePause()}
              />
              <Column style={styles.separator} />
              <ActionRow
                label="Supprimer la routine"
                icon="xmark"
                destructive
                disabled={busy}
                onPress={confirmDelete}
              />
            </Column>
            <Spacer />
          </Row>
        </Screen>
      )}
    </>
  );
}

function createStyles(colors: ReturnType<typeof usePalette>) {
  return StyleSheet.create({
    content: { width: fillParent },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 18,
      width: fillParent,
    },
    separator: {
      width: fillParent,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.separator,
    },
    centeredText: { textAlign: "center" },
  });
}
