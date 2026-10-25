import { Button, Column, Row, Spacer } from "@expo/ui";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import {
  ActionButton,
  AppSymbol,
  AppText,
  centerAvailableWidth,
  fillAvailableWidth,
  fillParent,
  SheetHeader,
  ProductBadge,
  Screen,
  usePalette,
} from "@/components/ui";
import { useRoutineStore } from "@/routines/RoutinesProvider";
import { dateLabel, frequencyLabel, timeLabel } from "@/routines/display";
import { FrequencyKind } from "@nutritual/protocol";

export default function RecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { routines, busy, error, record } = useRoutineStore();
  const colors = usePalette();
  const [today] = useState(() => new Date());
  const [isSelected, setIsSelected] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const routine = routines.find((item) => item.id === id);
  const isActionDisabled = busy || isSaving;
  const errorMessage = feedback ?? error;

  const schedule = routine
    ? routine.frequency.kind === FrequencyKind.asNeeded
      ? frequencyLabel(routine.frequency)
      : `${timeLabel(new Date(`2000-01-01T${routine.time}:00`))} · ${frequencyLabel(routine.frequency)}`
    : "";

  const styles = useMemo(() => createStyles(colors, isSelected), [colors, isSelected]);

  async function save() {
    if (!routine || !isSelected || isActionDisabled) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      if (await record(routine.id)) router.back();
      else setFeedback("Impossible d’enregistrer la prise. Réessayez.");
    } catch {
      setFeedback("Impossible d’enregistrer la prise. Réessayez.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!routine) {
    return (
      <Screen grouped>
        <AppText color={error ? colors.danger : colors.text}>
          {busy ? "Chargement de la routine…" : (error ?? "Routine introuvable.")}
        </AppText>
        {!busy ? (
          <ActionButton kind="secondary" label="Fermer" onPress={() => router.back()} />
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen
      grouped
      footer={
        <ActionButton
          label={isSaving ? "Enregistrement…" : "Enregistrer la prise"}
          onPress={() => void save()}
          disabled={!isSelected || isActionDisabled}
        />
      }
    >
      <SheetHeader title={dateLabel(today)} />
      <Row alignment="center">
        <Column alignment="center" spacing={14} style={styles.content}>
          <ProductBadge size={96} />
          <AppText
            modifiers={centerAvailableWidth}
            variant="largeTitle"
            textStyle={styles.centeredText}
          >
            {routine.frequency.kind === FrequencyKind.asNeeded
              ? "À la demande"
              : `Prise de ${schedule.split(" · ")[0]}`}
          </AppText>
        </Column>
        <Spacer />
      </Row>
      <Row alignment="center">
        <Column alignment="center" spacing={16} style={styles.card}>
          <Row alignment="center" modifiers={fillAvailableWidth} spacing={12}>
            <ProductBadge />
            <Column alignment="start" spacing={5}>
              <AppText variant="headline">{routine.productName}</AppText>
              <AppText variant="footnote" color={colors.secondary}>
                {schedule}
              </AppText>
            </Column>
            <Spacer />
          </Row>
          <Button
            disabled={isActionDisabled}
            onPress={() => setIsSelected((value) => !value)}
            style={styles.selectButton}
            testID="select-intake"
            variant="text"
          >
            <Row alignment="center" spacing={8}>
              <Spacer />
              <AppSymbol name="checkmark" color={isSelected ? colors.blue : colors.secondary} />
              <AppText variant="headline" color={isSelected ? colors.blue : colors.text}>
                Pris
              </AppText>
              <Spacer />
            </Row>
          </Button>
        </Column>
        <Spacer />
      </Row>
      {errorMessage ? (
        <AppText variant="subhead" color={colors.danger}>
          {errorMessage}
        </AppText>
      ) : null}
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof usePalette>, isSelected: boolean) {
  return StyleSheet.create({
    content: { width: fillParent },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.separator,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 20,
      width: fillParent,
    },
    selectButton: {
      backgroundColor: isSelected ? colors.upcoming : colors.grouped,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 20,
      width: fillParent,
    },
    centeredText: { textAlign: "center" },
  });
}
