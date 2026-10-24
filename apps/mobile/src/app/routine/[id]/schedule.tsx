import { useState } from "react";
import { Column, Row, TextInput } from "@expo/ui";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, useWindowDimensions } from "react-native";
import { ActionButton, AppText, Screen, usePalette } from "../../../components/ui";
import DateField from "../../../components/ui/DateField";
import ChoiceRow from "../../../components/routine-form/ChoiceRow";
import { useRoutineDraft } from "../../../components/routine-form/RoutineDraftProvider";
import { localDate, validateRoutine } from "../../../routines/model";
import type { Frequency } from "../../../routines/model";
import { useRoutineStore } from "../../../routines/RoutinesProvider";

const week = [
  ["Lundi", 1],
  ["Mardi", 2],
  ["Mercredi", 3],
  ["Jeudi", 4],
  ["Vendredi", 5],
  ["Samedi", 6],
  ["Dimanche", 0],
] as const;

const allDays = [0, 1, 2, 3, 4, 5, 6];

export default function RoutineScheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { draft, setDraft, ready, missing } = useRoutineDraft();
  const { error, reload } = useRoutineStore();
  const colors = usePalette();
  const { width, fontScale } = useWindowDimensions();
  const [today] = useState(() => new Date());
  const [validationError, setValidationError] = useState<string | null>(null);
  const [interval, setInterval] = useState({ every: 2, startDate: localDate(today) });

  const styles = StyleSheet.create({
    group: {
      width: width - 40,
      paddingHorizontal: 16,
      paddingVertical: 4,
      borderRadius: 26,
      backgroundColor: colors.grouped,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.separator,
      width: width - 72,
    },
    numberRow: {
      width: width - 40,
      padding: 16,
      backgroundColor: colors.grouped,
      borderRadius: 24,
    },
    numberLabel: { width: width - 174 },
    input: { width: 86, padding: 8, backgroundColor: colors.surface, borderRadius: 12 },
    numberText: { color: colors.blue, fontSize: 20 * fontScale, textAlign: "center" },
  });

  if (!ready || !draft)
    return (
      <Screen>
        <AppText>{missing ? "Routine introuvable." : (error ?? "Chargement…")}</AppText>
        <ActionButton
          label={error ? "Réessayer" : "Fermer"}
          onPress={() => (error ? void reload() : router.dismissAll())}
        />
      </Screen>
    );

  const frequency = draft.frequency;
  const days = frequency.kind === "weekdays" ? frequency.days : [];
  const daily = frequency.kind === "weekdays" && days.length === 7;
  const anchor = frequency.kind === "interval" ? frequency.startDate : interval.startDate;
  const every = frequency.kind === "interval" ? frequency.every : interval.every;

  function choose(next: Frequency) {
    if (!draft) return;

    if (frequency.kind === "interval")
      setInterval({ every: frequency.every, startDate: frequency.startDate });
    setDraft({ ...draft, frequency: next });
    setValidationError(null);
  }

  function continueToReview() {
    if (!draft) return;
    const validation = validateRoutine(draft);
    setValidationError(validation);

    if (!validation) router.push(`/routine/${id}/review`);
  }

  return (
    <Screen
      footer={
        <Column spacing={8}>
          {validationError && (
            <AppText variant="footnote" color={colors.danger}>
              {validationError}
            </AppText>
          )}
          <ActionButton
            label="Continuer"
            onPress={continueToReview}
            testID="routine-schedule-continue"
          />
        </Column>
      }
    >
      <AppText variant="largeTitle">À quel rythme ?</AppText>
      <Column spacing={12}>
        <AppText variant="headline">Fréquence</AppText>
        <Column spacing={0} style={styles.group}>
          <ChoiceRow
            label="Chaque jour"
            detail="À la même heure, tous les jours"
            selected={daily}
            onPress={() => choose({ kind: "weekdays", days: allDays })}
          />
          <Column style={styles.separator} />
          <ChoiceRow
            label="Certains jours"
            detail="Les jours de votre choix"
            selected={frequency.kind === "weekdays" && !daily}
            onPress={() =>
              choose({ kind: "weekdays", days: !daily && days.length ? days : [1, 2, 3, 4, 5] })
            }
          />
          <Column style={styles.separator} />
          <ChoiceRow
            label="Tous les N jours"
            detail="Tous les 2 jours, tous les 3 jours…"
            selected={frequency.kind === "interval"}
            onPress={() => choose({ kind: "interval", every, startDate: anchor })}
          />
          <Column style={styles.separator} />
          <ChoiceRow
            label="À la demande"
            detail="Sans rappel automatique"
            selected={frequency.kind === "as-needed"}
            onPress={() => choose({ kind: "as-needed" })}
          />
        </Column>
      </Column>

      {frequency.kind === "weekdays" && !daily && (
        <Column spacing={12}>
          <AppText variant="headline">Jours de prise</AppText>
          <Column spacing={0} style={styles.group}>
            {week.map(([name, day], index) => (
              <Column key={day} spacing={0}>
                {index > 0 && <Column style={styles.separator} />}
                <ChoiceRow
                  label={name}
                  selected={days.includes(day)}
                  onPress={() =>
                    choose({
                      kind: "weekdays",
                      days: days.includes(day)
                        ? days.filter((item) => item !== day)
                        : [...days, day].sort(),
                    })
                  }
                />
              </Column>
            ))}
          </Column>
        </Column>
      )}

      {frequency.kind === "interval" && (
        <Column spacing={12}>
          <AppText variant="headline">Intervalle</AppText>
          <Row spacing={12} alignment="center" style={styles.numberRow}>
            <Column alignment="start" style={styles.numberLabel}>
              <AppText>Nombre de jours</AppText>
            </Column>
            <TextInput
              defaultValue={String(every)}
              onChangeText={(value) => choose({ ...frequency, every: Number(value) })}
              selectTextOnFocus
              keyboardType="number-pad"
              maxLength={5}
              style={styles.input}
              textStyle={styles.numberText}
              testID="interval-days"
            />
          </Row>
          <DateField
            label="Date de début"
            mode="date"
            value={dateWithTime(anchor, "12:00")}
            onChange={(value) => choose({ ...frequency, startDate: localDate(value) })}
            testID="start-date"
          />
        </Column>
      )}

      {frequency.kind !== "as-needed" && (
        <Column spacing={12}>
          <AppText variant="headline">Heure de prise</AppText>
          <DateField
            label="Prendre à"
            mode="time"
            value={dateWithTime(localDate(today), draft.time)}
            onChange={(value) =>
              setDraft({
                ...draft,
                time:
                  String(value.getHours()).padStart(2, "0") +
                  ":" +
                  String(value.getMinutes()).padStart(2, "0"),
              })
            }
            testID="routine-time"
          />
        </Column>
      )}
    </Screen>
  );
}

function dateWithTime(dateValue: string, timeValue: string): Date {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(hours, minutes, 0, 0);

  return date;
}
