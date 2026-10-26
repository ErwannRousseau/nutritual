import { useMemo } from "react";
import { Button, Column, Row, Spacer } from "@expo/ui";
import { router, Stack } from "expo-router";
import { StyleSheet } from "react-native";
import { useRoutineStore } from "@/features/routines/RoutinesProvider";
import AppText from "@/shared/ui/AppText";
import AppSymbol from "@/shared/ui/AppSymbol";
import ProductBadge from "@/shared/ui/ProductBadge";
import Screen from "@/shared/ui/Screen";
import { fillAvailableWidth, fillParent } from "@/shared/ui/layout";
import { usePalette } from "@/shared/ui/palette";
import UpcomingCard from "@/features/routines/components/UpcomingCard";
import IntakeRow from "@/features/home/components/IntakeRow";
import RoutineRow from "@/features/home/components/RoutineRow";
import { useDailyOverview } from "@/features/home/useDailyOverview";

export default function DailyOverview() {
  const { routines, intakes, reminders, busy, error, reload } = useRoutineStore();
  const { now, logged, upcoming, asNeeded } = useDailyOverview(routines, intakes);
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
          <AppText variant="title" textStyle={styles.centered}>
            Today
          </AppText>
          <AppText variant="headline" color={colors.secondary} textStyle={styles.centered}>
            {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </AppText>
        </Column>

        {!!error && (
          <Column spacing={12} style={styles.error}>
            <AppText color={colors.danger}>{error}</AppText>
            <Button
              label="Try again"
              variant="text"
              disabled={busy}
              onPress={() => void reload()}
            />
          </Column>
        )}

        {busy && routines.length === 0 && !error ? (
          <AppText color={colors.secondary}>Loading routines…</AppText>
        ) : (
          <>
            <Column modifiers={fillAvailableWidth} spacing={12}>
              <AppText variant="title">To take</AppText>
              {upcoming.map((routine) => (
                <UpcomingCard
                  key={routine.id}
                  routine={routine}
                  reminder={reminders.find((item) => item.routineId === routine.id)}
                  onPress={() =>
                    router.push({ pathname: "/record/[id]", params: { id: routine.id } })
                  }
                />
              ))}
              {upcoming.length === 0 && (
                <Column spacing={12} style={styles.group}>
                  {routines.length === 0 && <ProductBadge size={96} />}
                  <AppText variant="headline">
                    {routines.length === 0 ? "Your first routine" : "Nothing scheduled today"}
                  </AppText>
                  <AppText color={colors.secondary}>
                    {routines.length === 0
                      ? "Add a supplement to organize your intakes and get reminders."
                      : logged.length
                        ? "Your recorded intakes are below."
                        : "Your supplements are available in the list below."}
                  </AppText>
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
                    <AppText>As needed</AppText>
                    <Spacer />
                    <AppSymbol name="plus" size={24} color={colors.blue} />
                  </Row>
                </Button>
              )}
            </Column>

            <Column spacing={4} style={styles.group}>
              <Row alignment="center">
                <AppText variant="title">Today's intakes</AppText>
              </Row>
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
                <AppText color={colors.secondary}>No intakes recorded today.</AppText>
              )}
              <Column style={styles.separator} />
              <Button
                style={styles.fullWidthButton}
                variant="text"
                onPress={() => router.push("/history")}
              >
                <Row modifiers={fillAvailableWidth} alignment="center">
                  <AppText color={colors.blue}>View history</AppText>
                  <Spacer />
                  <AppSymbol name="chevron.right" size={14} color={colors.blue} />
                </Row>
              </Button>
            </Column>

            {routines.length > 0 && (
              <Column spacing={12}>
                <AppText variant="title">Your supplements</AppText>
                <Column style={styles.group} spacing={0}>
                  {routines.map((routine, index) => (
                    <Column key={routine.id} spacing={0}>
                      {index > 0 && <Column style={styles.separator} />}
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
    date: { paddingTop: 16, paddingBottom: 12, width: fillParent },
    centered: { textAlign: "center" },
    fullWidthButton: { width: fillParent },
    group: {
      backgroundColor: colors.grouped,
      borderRadius: 28,
      padding: 16,
      width: fillParent,
    },
    needed: {
      backgroundColor: colors.upcoming,
      padding: 16,
      borderRadius: 28,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.separator,
      width: fillParent,
    },
    error: {
      backgroundColor: colors.grouped,
      borderRadius: 20,
      padding: 16,
      width: fillParent,
    },
  });
}
