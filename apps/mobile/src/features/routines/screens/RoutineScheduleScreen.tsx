import { useMemo, useState } from "react";
import { Column, Row, Spacer, TextInput } from "@expo/ui";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, useWindowDimensions } from "react-native";
import ActionButton from "@/shared/ui/ActionButton";
import AppText from "@/shared/ui/AppText";
import DateField from "@/shared/ui/DateField";
import { fillAvailableWidth, fillParent } from "@/shared/ui/layout";
import Screen from "@/shared/ui/Screen";
import { usePalette } from "@/shared/ui/palette";
import ChoiceRow from "@/features/routines/components/ChoiceRow";
import { FrequencyKind } from "@nutritual/protocol";
import { useRoutineDraft } from "@/features/routines/RoutineDraftProvider";
import { localDate, validateRoutine } from "@/features/routines/model";
import type { Frequency } from "@nutritual/protocol";
import { useRoutineStore } from "@/features/routines/RoutinesProvider";

const week = [
  ["Monday", 1],
  ["Tuesday", 2],
  ["Wednesday", 3],
  ["Thursday", 4],
  ["Friday", 5],
  ["Saturday", 6],
  ["Sunday", 0],
] as const;

const allDays = week.map(([, day]) => day);

export default function RoutineScheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { draft, setDraft, ready, missing } = useRoutineDraft();
  const { error, reload } = useRoutineStore();
  const colors = usePalette();
  const { fontScale } = useWindowDimensions();
  const [today] = useState(() => new Date());
  const [validationError, setValidationError] = useState<string | null>(null);
  const [interval, setInterval] = useState({ every: 2, startDate: localDate(today) });

  const styles = useMemo(() => createStyles(colors, fontScale), [colors, fontScale]);

  if (!ready || !draft)
    return (
      <Screen>
        <AppText>{missing ? "Routine not found." : (error ?? "Loading…")}</AppText>
        <ActionButton
          label={error ? "Try again" : "Close"}
          onPress={() => (error ? void reload() : router.dismissAll())}
        />
      </Screen>
    );

  const frequency = draft.frequency;
  const days = frequency.kind === FrequencyKind.weekdays ? frequency.days : [];
  const daily = frequency.kind === FrequencyKind.weekdays && days.length === 7;

  const anchor =
    frequency.kind === FrequencyKind.interval ? frequency.startDate : interval.startDate;

  const every = frequency.kind === FrequencyKind.interval ? frequency.every : interval.every;

  function choose(next: Frequency) {
    if (!draft) return;

    if (frequency.kind === FrequencyKind.interval)
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
            label="Continue"
            onPress={continueToReview}
            testID="routine-schedule-continue"
          />
        </Column>
      }
    >
      <AppText variant="largeTitle">How often?</AppText>
      <Column modifiers={fillAvailableWidth} spacing={12}>
        <AppText variant="headline">Frequency</AppText>
        <Column spacing={0} style={styles.group}>
          <ChoiceRow
            label="Every day"
            detail="At the same time every day"
            selected={daily}
            onPress={() => choose({ kind: FrequencyKind.weekdays, days: allDays })}
          />
          <Column style={styles.separator} />
          <ChoiceRow
            label="Selected days"
            detail="Choose which days"
            selected={frequency.kind === FrequencyKind.weekdays && !daily}
            onPress={() =>
              choose({
                kind: FrequencyKind.weekdays,
                days: !daily && days.length ? days : [1, 2, 3, 4, 5],
              })
            }
          />
          <Column style={styles.separator} />
          <ChoiceRow
            label="Every N days"
            detail="Every 2 days, every 3 days…"
            selected={frequency.kind === FrequencyKind.interval}
            onPress={() => choose({ kind: FrequencyKind.interval, every, startDate: anchor })}
          />
          <Column style={styles.separator} />
          <ChoiceRow
            label="As needed"
            detail="No automatic reminders"
            selected={frequency.kind === FrequencyKind.asNeeded}
            onPress={() => choose({ kind: FrequencyKind.asNeeded })}
          />
        </Column>
      </Column>

      {frequency.kind === FrequencyKind.weekdays && !daily && (
        <Column modifiers={fillAvailableWidth} spacing={12}>
          <AppText variant="headline">Intake days</AppText>
          <Column spacing={0} style={styles.group}>
            {week.map(([name, day], index) => (
              <Column key={day} spacing={0}>
                {index > 0 && <Column style={styles.separator} />}
                <ChoiceRow
                  label={name}
                  selected={days.includes(day)}
                  onPress={() =>
                    choose({
                      kind: FrequencyKind.weekdays,
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

      {frequency.kind === FrequencyKind.interval && (
        <Column modifiers={fillAvailableWidth} spacing={12}>
          <AppText variant="headline">Interval</AppText>
          <Row spacing={12} alignment="center" style={styles.numberRow}>
            <Column alignment="start">
              <AppText>Number of days</AppText>
            </Column>
            <Spacer />
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
            label="Start date"
            mode="date"
            value={dateWithTime(anchor, "12:00")}
            onChange={(value) => choose({ ...frequency, startDate: localDate(value) })}
            testID="start-date"
          />
        </Column>
      )}

      {frequency.kind !== FrequencyKind.asNeeded && (
        <Column modifiers={fillAvailableWidth} spacing={12}>
          <AppText variant="headline">Intake time</AppText>
          <DateField
            label="Take at"
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

function createStyles(colors: ReturnType<typeof usePalette>, fontScale: number) {
  return StyleSheet.create({
    group: {
      width: fillParent,
      paddingHorizontal: 16,
      paddingVertical: 4,
      borderRadius: 26,
      backgroundColor: colors.grouped,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.separator,
      width: fillParent,
    },
    numberRow: {
      width: fillParent,
      padding: 16,
      backgroundColor: colors.grouped,
      borderRadius: 24,
    },
    input: { width: 86, padding: 8, backgroundColor: colors.surface, borderRadius: 12 },
    numberText: { color: colors.blue, fontSize: 20 * fontScale, textAlign: "center" },
  });
}
