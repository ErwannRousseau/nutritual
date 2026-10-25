import { useEffect, useMemo, useState } from "react";
import { Button, Column, Row, Spacer } from "@expo/ui";
import { router, Stack } from "expo-router";
import { AppState, StyleSheet } from "react-native";
import { useRoutineStore } from "@/routines/RoutinesProvider";
import { isDueOn, localDate } from "@/routines/model";
import AppText from "@/components/ui/AppText";
import AppSymbol from "@/components/ui/AppSymbol";
import ProductBadge from "@/components/ui/ProductBadge";
import Screen from "@/components/ui/Screen";
import { fillAvailableWidth, fillParent } from "@/components/ui/layout";
import { usePalette } from "@/components/ui/palette";
import { FrequencyKind } from "@nutritual/protocol";
import UpcomingCard from "@/components/overview/UpcomingCard";
import IntakeRow from "@/components/overview/IntakeRow";
import RoutineRow from "@/components/overview/RoutineRow";

export default function DailyOverview() {
  const { routines, intakes, reminders, busy, error, reload } = useRoutineStore();
  const [now, setNow] = useState(() => new Date());
  const colors = usePalette();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = setInterval(refresh, 60_000);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  const today = localDate(now);

  const logged = intakes
    .filter((intake) => localDate(new Date(intake.recordedAt)) === today)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  const recorded = new Set(logged.map((intake) => intake.routineId));

  const upcoming = routines
    .filter((routine) => isDueOn(routine, now) && !recorded.has(routine.id))
    .sort((a, b) => a.time.localeCompare(b.time));

  const asNeeded = routines.some(
    (routine) => !routine.paused && routine.frequency.kind === FrequencyKind.asNeeded,
  );

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button tintColor={colors.blue} onPress={() => router.push("/routine/new")}>
          Ajouter
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Screen>
        <Column alignment="center" spacing={4} style={styles.date}>
          <AppText variant="title" textStyle={styles.centered}>
            Aujourd’hui
          </AppText>
          <AppText variant="headline" color={colors.secondary} textStyle={styles.centered}>
            {now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </AppText>
        </Column>

        {!!error && (
          <Column spacing={12} style={styles.error}>
            <AppText color={colors.danger}>{error}</AppText>
            <Button
              label="Réessayer"
              variant="text"
              disabled={busy}
              onPress={() => void reload()}
            />
          </Column>
        )}

        {busy && routines.length === 0 && !error ? (
          <AppText color={colors.secondary}>Chargement des routines…</AppText>
        ) : (
          <>
            <Column modifiers={fillAvailableWidth} spacing={12}>
              <AppText variant="title">À prendre</AppText>
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
                    {routines.length === 0 ? "Votre première routine" : "Rien de prévu aujourd’hui"}
                  </AppText>
                  <AppText color={colors.secondary}>
                    {routines.length === 0
                      ? "Ajoutez un complément pour organiser vos prises et recevoir vos rappels."
                      : logged.length
                        ? "Vos prises enregistrées sont ci-dessous."
                        : "Vos compléments restent accessibles dans la liste ci-dessous."}
                  </AppText>
                  {routines.length === 0 && (
                    <Button
                      label="Ajouter un complément"
                      onPress={() => router.push("/routine/new")}
                    />
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
                    <AppText>À la demande</AppText>
                    <Spacer />
                    <AppSymbol name="plus" size={24} color={colors.blue} />
                  </Row>
                </Button>
              )}
            </Column>

            <Column spacing={4} style={styles.group}>
              <Row alignment="center">
                <AppText variant="title">Prises du jour</AppText>
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
                <AppText color={colors.secondary}>Aucune prise enregistrée aujourd’hui.</AppText>
              )}
              <Column style={styles.separator} />
              <Button
                style={styles.fullWidthButton}
                variant="text"
                onPress={() => router.push("/history")}
              >
                <Row modifiers={fillAvailableWidth} alignment="center">
                  <AppText color={colors.blue}>Voir l’historique</AppText>
                  <Spacer />
                  <AppSymbol name="chevron.right" size={14} color={colors.blue} />
                </Row>
              </Button>
            </Column>

            {routines.length > 0 && (
              <Column spacing={12}>
                <AppText variant="title">Vos compléments</AppText>
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
