import { useMemo } from "react";
import { Button, Column, Row, Spacer } from "@expo/ui";
import { router, Stack } from "expo-router";
import { StyleSheet } from "react-native";
import Text from "@/shared/ui/Text";
import AppSymbol from "@/shared/ui/AppSymbol";
import ProductBadge from "@/shared/ui/ProductBadge";
import Separator from "@/shared/ui/Separator";
import Screen from "@/shared/ui/Screen";
import { fillAvailableWidth, fillContainerWidth, fullWidth } from "@/shared/ui/layout";
import { usePalette } from "@/shared/ui/palette";
import ScheduledGroupButton from "@/features/home/components/ScheduledGroupButton";
import IntakeRow from "@/features/home/components/IntakeRow";
import RoutineRow from "@/features/home/components/RoutineRow";
import { useDailyOverview } from "@/features/home/useDailyOverview";
import { useRoutineStore } from "@/features/routines/RoutinesProvider";
import { ReminderOutcomes } from "@nutritual/protocol";

export default function DailyOverview() {
  const { routines, intakes, reminders, busy, error, reload, skippedOccurrences } =
    useRoutineStore();

  const { now, logged, upcoming, asNeeded } = useDailyOverview(
    routines,
    intakes,
    skippedOccurrences,
  );

  const colors = usePalette();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button tintColor={colors.blue} onPress={() => router.push("/settings")}>
          Pairing
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Button tintColor={colors.blue} onPress={() => router.push("/routine/new")}>
          Add
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Screen>
        <Column alignment="center" spacing={4} style={styles.date}>
          <Text variant="title" textStyle={styles.centered}>
            Today
          </Text>
          <Text variant="headline" color={colors.secondary} textStyle={styles.centered}>
            {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </Text>
        </Column>

        {!!error && (
          <Column spacing={12} style={styles.error}>
            <Text color={colors.danger}>{error}</Text>
            <Button
              label="Try again"
              variant="text"
              disabled={busy}
              onPress={() => void reload()}
            />
          </Column>
        )}

        {busy && routines.length === 0 && !error ? (
          <Text color={colors.secondary}>Loading routines…</Text>
        ) : (
          <>
            <Column modifiers={fillAvailableWidth} spacing={12}>
              <Text variant="title">To take</Text>
              {[...new Set(upcoming.map((routine) => routine.time))].map((time) => {
                const group = upcoming.filter((routine) => routine.time === time);

                return (
                  <ScheduledGroupButton
                    key={time}
                    backgroundColor={colors.grouped}
                    onPress={() => router.push({ pathname: "/routine-group", params: { time } })}
                  >
                    <Text variant="headline">{time}</Text>
                    {group.map((routine) => {
                      const reminder = reminders.find((item) => item.routineId === routine.id);

                      const warning =
                        reminder?.status === ReminderOutcomes.denied ||
                        reminder?.status === ReminderOutcomes.failed;

                      return (
                        <Column key={routine.id} spacing={2}>
                          <Text>{routine.productName}</Text>
                          {routine.quantity ? (
                            <Text variant="footnote" color={colors.secondary}>
                              {routine.quantity.amount + " " + routine.quantity.unit}
                            </Text>
                          ) : null}
                          {warning ? (
                            <Text variant="footnote" color={colors.danger}>
                              Reminder inactive
                            </Text>
                          ) : null}
                        </Column>
                      );
                    })}
                    <Text color={colors.blue}>
                      {group.length + (group.length === 1 ? " supplement" : " supplements")}
                    </Text>
                  </ScheduledGroupButton>
                );
              })}
              {upcoming.length === 0 && (
                <Column spacing={12} style={styles.group}>
                  {routines.length === 0 && <ProductBadge size={96} />}
                  <Text variant="headline">
                    {routines.length === 0 ? "Your first routine" : "Nothing scheduled today"}
                  </Text>
                  <Text color={colors.secondary}>
                    {routines.length === 0
                      ? "Add a supplement to organize your intakes and get reminders."
                      : logged.length
                        ? "Your recorded intakes are below."
                        : "Your supplements are available in the list below."}
                  </Text>
                  {routines.length === 0 && (
                    <Button label="Add a supplement" onPress={() => router.push("/routine/new")} />
                  )}
                </Column>
              )}
              {asNeeded && (
                <Button
                  style={styles.fullWidthButton}
                  variant="text"
                  onPress={() => router.push("/as-needed")}
                >
                  <Row
                    modifiers={fillAvailableWidth}
                    alignment="center"
                    spacing={12}
                    style={styles.needed}
                  >
                    <Text>As needed</Text>
                    <Spacer />
                    <AppSymbol name="plus" size={24} color={colors.blue} />
                  </Row>
                </Button>
              )}
            </Column>

            <Row modifiers={fillContainerWidth}>
              <Column spacing={4} style={styles.group}>
                <Text variant="title">Today's intakes</Text>
                {logged.length > 0 ? (
                  logged.map((intake) => (
                    <IntakeRow
                      key={intake.id}
                      intake={intake}
                      onPress={() =>
                        router.push({ pathname: "/intake/[id]", params: { id: intake.id } })
                      }
                    />
                  ))
                ) : (
                  <Text color={colors.secondary}>No intakes recorded today.</Text>
                )}
                <Separator />
                <Button
                  style={styles.fullWidthButton}
                  variant="text"
                  onPress={() => router.push("/history")}
                >
                  <Row modifiers={fillAvailableWidth} alignment="center">
                    <Text color={colors.blue}>View history</Text>
                    <Spacer />
                    <AppSymbol name="chevron.right" size={14} color={colors.blue} />
                  </Row>
                </Button>
              </Column>
            </Row>

            {routines.length > 0 && (
              <Column spacing={12}>
                <Text variant="title">Your supplements</Text>
                <Column style={styles.group} spacing={0}>
                  {routines.map((routine, index) => (
                    <Column key={routine.id} spacing={0}>
                      {index > 0 && <Separator />}
                      <RoutineRow
                        routine={routine}
                        reminder={reminders.find((item) => item.routineId === routine.id)}
                        onPress={() =>
                          router.push({
                            pathname: "/routine-detail/[id]",
                            params: { id: routine.id },
                          })
                        }
                      />
                    </Column>
                  ))}
                </Column>
              </Column>
            )}
          </>
        )}
      </Screen>
    </>
  );
}

function createStyles(colors: ReturnType<typeof usePalette>) {
  return StyleSheet.create({
    date: { paddingTop: 16, paddingBottom: 12, width: fullWidth },
    centered: { textAlign: "center" },
    fullWidthButton: { width: fullWidth },
    group: {
      backgroundColor: colors.grouped,
      borderRadius: 28,
      padding: 16,
      width: fullWidth,
    },
    needed: {
      backgroundColor: colors.upcoming,
      padding: 16,
      borderRadius: 28,
    },
    error: {
      backgroundColor: colors.grouped,
      borderRadius: 20,
      padding: 16,
      width: fullWidth,
    },
  });
}
