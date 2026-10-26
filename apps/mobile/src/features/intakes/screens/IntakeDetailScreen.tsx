import { Column, Row, Spacer } from "@expo/ui";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import ActionButton from "@/shared/ui/ActionButton";
import AppSymbol from "@/shared/ui/AppSymbol";
import AppText from "@/shared/ui/AppText";
import { centerAvailableWidth, fillParent } from "@/shared/ui/layout";
import ProductBadge from "@/shared/ui/ProductBadge";
import Screen from "@/shared/ui/Screen";
import SheetHeader from "@/shared/ui/SheetHeader";
import { usePalette } from "@/shared/ui/palette";
import { dateLabel, timeLabel } from "@/features/routines/display";
import { useRoutineStore } from "@/features/routines/RoutinesProvider";

export default function IntakeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { intakes, busy, error, undo } = useRoutineStore();
  const colors = usePalette();
  const [isUndoing, setIsUndoing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const intake = intakes.find((item) => item.id === id);
  const parsedDate = intake ? new Date(intake.recordedAt) : null;
  const recordedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
  const isActionDisabled = busy || isUndoing;
  const errorMessage = feedback ?? error;
  const styles = useMemo(() => createStyles(colors), [colors]);

  async function removeIntake() {
    if (!intake || isActionDisabled) return;
    setIsUndoing(true);
    setFeedback(null);

    try {
      if (await undo(intake.id)) router.back();
      else setFeedback("Impossible d’annuler cette prise. Réessayez.");
    } catch {
      setFeedback("Impossible d’annuler cette prise. Réessayez.");
    } finally {
      setIsUndoing(false);
    }
  }

  if (!intake) {
    return (
      <Screen grouped>
        <AppText color={error ? colors.danger : colors.text}>
          {busy ? "Chargement de la prise…" : (error ?? "Prise introuvable.")}
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
          kind="destructive"
          label={isUndoing ? "Annulation…" : "Annuler la prise"}
          onPress={() => void removeIntake()}
          disabled={isActionDisabled}
        />
      }
    >
      <SheetHeader title="Prise enregistrée" />
      <Row alignment="center">
        <Column alignment="center" spacing={12} style={styles.fullWidth}>
          <Column alignment="center" style={styles.check}>
            <Spacer flexible />
            <AppSymbol name="checkmark" size={40} color={colors.cyan} />
            <Spacer flexible />
          </Column>
          <AppText
            modifiers={centerAvailableWidth}
            variant="largeTitle"
            textStyle={styles.centeredText}
          >
            {recordedAt ? timeLabel(recordedAt) : "Prise enregistrée"}
          </AppText>
          {recordedAt ? (
            <AppText
              color={colors.secondary}
              modifiers={centerAvailableWidth}
              textStyle={styles.centeredText}
            >
              {dateLabel(recordedAt)}
            </AppText>
          ) : null}
        </Column>
        <Spacer />
      </Row>
      <Row alignment="center">
        <Row alignment="center" spacing={12} style={styles.card}>
          <ProductBadge />
          <Column spacing={4}>
            <AppText variant="footnote" color={colors.secondary}>
              PRIS
            </AppText>
            <AppText variant="headline">{intake.productName}</AppText>
          </Column>
          <Spacer />
        </Row>
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
