import { Button, Column, Row, Spacer } from "@expo/ui";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import ActionButton from "@/shared/ui/ActionButton";
import AppSymbol from "@/shared/ui/AppSymbol";
import Text from "@/shared/ui/Text";
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
        <Text color={error ? colors.danger : colors.text}>
          {busy ? "Loading routine…" : (error ?? "Routine not found.")}
        </Text>
        {!busy ? (
          <ActionButton kind="secondary" label="Close" onPress={() => router.back()} />
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
          label={isSaving ? "Saving…" : "Record intake"}
          onPress={() => void save()}
          disabled={!isSelected || isActionDisabled}
        />
      }
    >
      <SheetHeader title={dateLabel(today)} />
      <Row alignment="center">
        <Column alignment="center" spacing={14} style={styles.content}>
          <ProductBadge size={96} />
          <Text
            modifiers={centerAvailableWidth}
            variant="largeTitle"
            textStyle={styles.centeredText}
          >
            {schedule.time ? `Intake at ${schedule.time}` : "As needed"}
          </Text>
        </Column>
        <Spacer />
      </Row>
      <Row alignment="center">
        <Column alignment="center" spacing={16} style={styles.card}>
          <Row alignment="center" modifiers={fillAvailableWidth} spacing={12}>
            <ProductBadge />
            <Column alignment="start" spacing={5}>
              <Text variant="headline">{routine.productName}</Text>
              <Text variant="footnote" color={colors.secondary}>
                {schedule.label}
              </Text>
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
              <Text variant="headline" color={isSelected ? colors.blue : colors.text}>
                Pris
              </Text>
              <Spacer />
            </Row>
          </Button>
        </Column>
        <Spacer />
      </Row>
      {errorMessage ? (
        <Text variant="subhead" color={colors.danger}>
          {errorMessage}
        </Text>
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
