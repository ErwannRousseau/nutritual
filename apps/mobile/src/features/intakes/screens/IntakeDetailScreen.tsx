import { Column, Row, Spacer } from "@expo/ui";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { StyleSheet } from "react-native";
import ActionButton from "@/shared/ui/ActionButton";
import AppSymbol from "@/shared/ui/AppSymbol";
import Text from "@/shared/ui/Text";
import { centerAvailableWidth, fillParent } from "@/shared/ui/layout";
import ProductBadge from "@/shared/ui/ProductBadge";
import Screen from "@/shared/ui/Screen";
import SheetHeader from "@/shared/ui/SheetHeader";
import { usePalette } from "@/shared/ui/palette";
import { dateLabel, timeLabel } from "@/features/routines/display";
import { useUndoIntake } from "@/features/intakes/useUndoIntake";

export default function IntakeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { intakes, busy, error, isUndoing, isActionDisabled, feedback, undoIntake } =
    useUndoIntake();

  const colors = usePalette();
  const intake = intakes.find((item) => item.id === id);
  const parsedDate = intake ? new Date(intake.recordedAt) : null;

  const recordedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;

  const errorMessage = feedback ?? error;
  const styles = useMemo(() => createStyles(colors), [colors]);

  async function removeIntake() {
    if (intake && (await undoIntake(intake.id))) router.back();
  }

  if (!intake) {
    return (
      <Screen grouped>
        <Text color={error ? colors.danger : colors.text}>
          {busy ? "Loading intake…" : (error ?? "Intake not found.")}
        </Text>
        {!busy ? (
          <ActionButton kind="secondary" label="Close" onPress={() => router.back()} />
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen
      grouped
      footer={
        <ActionButton
          kind="destructive"
          label={isUndoing ? "Undoing…" : "Undo intake"}
          onPress={() => void removeIntake()}
          disabled={isActionDisabled}
        />
      }
    >
      <SheetHeader title="Intake recorded" />
      <Row alignment="center">
        <Column alignment="center" spacing={12} style={styles.fullWidth}>
          <Column alignment="center" style={styles.check}>
            <Spacer flexible />
            <AppSymbol name="checkmark" size={40} color={colors.cyan} />
            <Spacer flexible />
          </Column>
          <Text
            modifiers={centerAvailableWidth}
            variant="largeTitle"
            textStyle={styles.centeredText}
          >
            {recordedAt ? timeLabel(recordedAt) : "Intake recorded"}
          </Text>
          {recordedAt ? (
            <Text
              color={colors.secondary}
              modifiers={centerAvailableWidth}
              textStyle={styles.centeredText}
            >
              {dateLabel(recordedAt)}
            </Text>
          ) : null}
        </Column>
        <Spacer />
      </Row>
      <Row alignment="center">
        <Row alignment="center" spacing={12} style={styles.card}>
          <ProductBadge />
          <Column spacing={4}>
            <Text variant="footnote" color={colors.secondary}>
              PRIS
            </Text>
            <Text variant="headline">{intake.productName}</Text>
          </Column>
          <Spacer />
        </Row>
        <Spacer />
      </Row>
      {intake.form ? (
        <Row alignment="center">
          <Text variant="subhead" color={colors.secondary}>
            {`Product form: ${intake.form}`}
          </Text>
          <Spacer />
        </Row>
      ) : null}
      {intake.quantity ? (
        <Row alignment="center">
          <Text variant="subhead" color={colors.secondary}>
            {`Recorded amount: ${intake.quantity.amount} ${intake.quantity.unit}`}
          </Text>
          <Spacer />
        </Row>
      ) : null}
      {errorMessage ? (
        <Text variant="subhead" color={colors.danger}>
          {errorMessage}
        </Text>
      ) : null}
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof usePalette>) {
  return StyleSheet.create({
    fullWidth: { width: fillParent },
    check: {
      backgroundColor: colors.upcoming,
      borderRadius: 48,
      height: 96,
      width: 96,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.separator,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 20,
      width: fillParent,
    },
    centeredText: { textAlign: "center" },
  });
}
