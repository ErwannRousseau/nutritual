import { Column, Row, Spacer } from "@expo/ui";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Alert, StyleSheet } from "react-native";
import ActionRow from "@/features/routines/components/ActionRow";
import AppText from "@/shared/ui/AppText";
import { centerAvailableWidth, fillParent } from "@/shared/ui/layout";
import ProductBadge from "@/shared/ui/ProductBadge";
import Screen from "@/shared/ui/Screen";
import { usePalette } from "@/shared/ui/palette";
import { reminderLabel, routineScheduleDisplay } from "@/features/routines/display";
import { useRoutineDetailActions } from "@/features/routines/useRoutineDetailActions";

export default function RoutineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { routines, reminders, busy, error, feedback, pauseRoutine, removeRoutine } =
    useRoutineDetailActions();

  const colors = usePalette();
  const routine = routines.find((item) => item.id === id);
  const reminder = reminders.find((item) => item.routineId === id);
  const errorMessage = feedback ?? error;
  const schedule = routine ? routineScheduleDisplay(routine).label : "";

  const styles = useMemo(() => createStyles(colors), [colors]);

  function confirmDelete() {
    if (!routine) return;
    Alert.alert(
      "Delete this routine?",
      `${routine.productName} will no longer appear in your schedule.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void removeRoutine(routine.id).then((removed) => {
              if (removed) router.back();
            });
          },
        },
      ],
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Supplement", headerShown: true }} />
      {!routine ? (
        <Screen grouped>
          <AppText color={error ? colors.danger : colors.text}>
            {busy ? "Loading routine…" : (error ?? "Routine not found.")}
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
                {routine.paused ? "Paused" : schedule}
              </AppText>
            </Column>
            <Spacer />
          </Row>
          <Row alignment="center">
            <Column spacing={12} style={styles.card}>
              <Row alignment="center">
                <Column spacing={4}>
                  <AppText variant="footnote" color={colors.secondary}>
                    Schedule
                  </AppText>
                  <AppText variant="subhead">{schedule}</AppText>
                </Column>
                <Spacer />
              </Row>
              <Row alignment="center">
                <Column spacing={4}>
                  <AppText variant="footnote" color={colors.secondary}>
                    Reminder
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
            MANAGEMENT
          </AppText>
          <Row alignment="center">
            <Column spacing={0} style={styles.card}>
              <ActionRow
                label="Edit"
                icon="ellipsis"
                disabled={busy}
                onPress={() => router.push(`/routine/${routine.id}`)}
              />
              <Column style={styles.separator} />
              <ActionRow
                label="Record intake"
                icon="checkmark"
                disabled={busy}
                onPress={() => router.push(`/record/${routine.id}`)}
              />
              <Column style={styles.separator} />
              <ActionRow
                label={routine.paused ? "Resume routine" : "Pause routine"}
                icon="pause"
                disabled={busy}
                onPress={() => void pauseRoutine(routine.id)}
              />
              <Column style={styles.separator} />
              <ActionRow
                label="Delete routine"
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
