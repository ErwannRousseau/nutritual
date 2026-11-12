import { Button, Column, RNHostView, Row, Spacer } from "@expo/ui";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text as NativeText } from "react-native";
import { useRoutineStore } from "@/features/routines/RoutinesProvider";
import { isDueOn, localDate, type Routine } from "@/features/routines/model";
import { useDailyOverview } from "@/features/home/useDailyOverview";
import { ReminderOutcomes } from "@nutritual/protocol";
import ActionButton from "@/shared/ui/ActionButton";
import IconButton from "@/shared/ui/IconButton";
import ProductBadge from "@/shared/ui/ProductBadge";
import Screen from "@/shared/ui/Screen";
import Text from "@/shared/ui/Text";
import { fillParent } from "@/shared/ui/layout";
import { usePalette } from "@/shared/ui/palette";

export default function TimeGroupScreen() {
  const { time: paramTime } = useLocalSearchParams<{ time: string }>();
  const time = Array.isArray(paramTime) ? paramTime[0] : paramTime;

  const { routines, intakes, reminders, skippedOccurrences, busy, error, record, skip } =
    useRoutineStore();

  const { now, upcoming, logged } = useDailyOverview(routines, intakes, skippedOccurrences);

  const [routineIds] = useState(() =>
    upcoming.filter((routine) => routine.time === time).map((routine) => routine.id),
  );

  const [savingAll, setSavingAll] = useState(false);
  const colors = usePalette();

  const styles = useMemo(() => createStyles(colors), [colors]);

  const group = routineIds
    .map((id) => routines.find((routine) => routine.id === id))
    .filter(
      (routine): routine is Routine =>
        routine !== undefined && routine.time === time && isDueOn(routine, now),
    );

  const takenIds = new Set(logged.map((intake) => intake.routineId));

  const skippedIds = new Set(
    skippedOccurrences
      .filter((occurrence) => occurrence.date === localDate(now))
      .map((item) => item.routineId),
  );

  const pending = group.filter(
    (routine) => !takenIds.has(routine.id) && !skippedIds.has(routine.id),
  );

  async function takeAll() {
    setSavingAll(true);

    for (const routine of pending) {
      if (!(await record(routine.id, routine.quantity, time))) break;
    }

    setSavingAll(false);
  }

  return (
    <>
      <Stack.Screen options={{ title: (time ?? "") + " Supplements", headerShown: false }} />
      <Screen
        grouped
        footer={<ActionButton kind="secondary" label="Done" onPress={() => router.back()} />}
      >
        <Row alignment="center">
          <Text variant="title">{time}</Text>
          <Spacer />
          <IconButton name="xmark" label="Close" onPress={() => router.back()} />
        </Row>
        <Column alignment="center" spacing={8}>
          <ProductBadge size={96} />
          <Text variant="largeTitle" textStyle={styles.centered}>
            {(time ?? "") + " Supplements"}
          </Text>
          <Text variant="headline" color={colors.secondary}>
            {group.length + (group.length === 1 ? " Supplement" : " Supplements")}
          </Text>
          {pending.length > 0 ? (
            <Button
              disabled={busy || savingAll}
              variant="text"
              onPress={() => void takeAll()}
              testID="take-all"
            >
              <Text color={colors.blue} textStyle={styles.takeAll}>
                Log All as Taken
              </Text>
            </Button>
          ) : null}
        </Column>
        {group.map((routine) => {
          const taken = takenIds.has(routine.id);
          const skipped = skippedIds.has(routine.id);
          const disabled = busy || savingAll || taken || skipped;
          const reminder = reminders.find((item) => item.routineId === routine.id);

          const warning =
            reminder?.status === ReminderOutcomes.denied ||
            reminder?.status === ReminderOutcomes.failed;

          return (
            <Column key={routine.id} spacing={12} style={styles.card}>
              <Row alignment="center" spacing={12}>
                <ProductBadge />
                <Column spacing={4}>
                  <Text variant="headline">{routine.productName}</Text>
                  <Text color={colors.secondary}>
                    {(routine.form ? routine.form + ", " : "") +
                      (routine.quantity
                        ? routine.quantity.amount + " " + routine.quantity.unit
                        : "Quantity not set")}
                  </Text>
                  {warning ? <Text color={colors.danger}>Reminder inactive</Text> : null}
                  {taken ? <Text color={colors.blue}>Taken</Text> : null}
                  {skipped ? <Text color={colors.secondary}>Skipped</Text> : null}
                </Column>
              </Row>
              {!taken && !skipped ? (
                <Row spacing={12}>
                  <Button
                    disabled={disabled}
                    style={styles.action}
                    variant="text"
                    onPress={() => void skip(routine.id)}
                  >
                    <Text color={colors.blue}>Skipped</Text>
                  </Button>
                  <Button
                    disabled={disabled}
                    style={styles.action}
                    variant="text"
                    onPress={() => void record(routine.id, routine.quantity, time)}
                  >
                    <Text color={colors.blue}>Taken</Text>
                  </Button>
                </Row>
              ) : null}
            </Column>
          );
        })}
        {error ? (
          <RNHostView matchContents>
            <NativeText
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={styles.error}
            >
              {error}
            </NativeText>
          </RNHostView>
        ) : null}
      </Screen>
    </>
  );
}

function createStyles(colors: ReturnType<typeof usePalette>) {
  return StyleSheet.create({
    centered: { textAlign: "center" },
    error: { color: colors.danger, fontSize: 17 },
    takeAll: { fontSize: 20, fontWeight: "600" },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 16,
      width: fillParent,
    },
    action: {
      backgroundColor: colors.upcoming,
      borderRadius: 14,
      flex: 1,
      paddingVertical: 10,
    },
  });
}
