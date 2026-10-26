import { Button, Column, Row, Spacer } from "@expo/ui";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import ActionButton from "@/shared/ui/ActionButton";
import AppSymbol from "@/shared/ui/AppSymbol";
import AppText from "@/shared/ui/AppText";
import { centerAvailableWidth, fillAvailableWidth, fillParent } from "@/shared/ui/layout";
import SheetHeader from "@/shared/ui/SheetHeader";
import ProductBadge from "@/shared/ui/ProductBadge";
import Screen from "@/shared/ui/Screen";
import { usePalette } from "@/shared/ui/palette";
import { dateLabel, routineScheduleDisplay } from "@/features/routines/display";
import { useRecordIntake } from "@/features/intakes/useRecordIntake";

export default function RecordIntakeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { routines, busy, error, isSaving, isActionDisabled, feedback, recordIntake } =
    useRecordIntake();

  const colors = usePalette();
  const [today] = useState(() => new Date());
  const [isSelected, setIsSelected] = useState(false);
  const routine = routines.find((item) => item.id === id);
  const errorMessage = feedback ?? error;

  const styles = useMemo(() => createStyles(colors, isSelected), [colors, isSelected]);

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

  const schedule = routineScheduleDisplay(routine);

  const save = async () => {
    if (await recordIntake(routine.id, isSelected)) router.back();
  };

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
            {schedule.time ? `Prise de ${schedule.time}` : "À la demande"}
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
                {schedule.label}
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
