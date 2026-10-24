import { Column, Row, Spacer } from "@expo/ui";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import {
  ActionButton,
  AppSymbol,
  AppText,
  ProductBadge,
  Screen,
  usePalette,
} from "../../components/ui";
import SheetHeader from "../../components/ui/SheetHeader";
import { dateLabel, timeLabel } from "../../routines/display";
import { useRoutineStore } from "../../routines/RoutinesProvider";

export default function IntakeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { intakes, busy, error, undo } = useRoutineStore();
  const colors = usePalette();
  const { width } = useWindowDimensions();
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const intake = intakes.find((item) => item.id === id);
  const recordedAt = intake ? new Date(intake.recordedAt) : null;
  const contentWidth = width - 40;
  const cardWidth = contentWidth - 40;
  const productWidth = contentWidth - 92;

  const styles = StyleSheet.create({
    fullWidth: { width: contentWidth },
    cardWidth: { width: cardWidth },
    check: { backgroundColor: colors.upcoming, borderRadius: 48, height: 96, width: 96 },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.separator,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 20,
      width: contentWidth,
    },
    product: { width: productWidth },
    centeredText: { textAlign: "center" },
  });

  async function removeIntake() {
    if (!intake || busy || saving) return;
    setSaving(true);
    setFeedback(null);

    try {
      if (await undo(intake.id)) router.back();
      else setFeedback(error ?? "Impossible d’annuler cette prise. Réessayez.");
    } catch {
      setFeedback("Impossible d’annuler cette prise. Réessayez.");
    } finally {
      setSaving(false);
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
          label={saving ? "Annulation…" : "Annuler la prise"}
          onPress={() => void removeIntake()}
          disabled={busy || saving}
        />
      }
    >
      <SheetHeader title="Prise enregistrée" />
      <Column alignment="center" spacing={12} style={styles.fullWidth}>
        <Column alignment="center" style={styles.check}>
          <Spacer flexible />
          <AppSymbol name="checkmark" size={40} color={colors.cyan} />
          <Spacer flexible />
        </Column>
        <AppText variant="largeTitle" style={styles.fullWidth} textStyle={styles.centeredText}>
          {recordedAt && !Number.isNaN(recordedAt.getTime())
            ? timeLabel(recordedAt)
            : "Prise enregistrée"}
        </AppText>
        {recordedAt && !Number.isNaN(recordedAt.getTime()) ? (
          <AppText
            color={colors.secondary}
            style={styles.fullWidth}
            textStyle={styles.centeredText}
          >
            {dateLabel(recordedAt)}
          </AppText>
        ) : null}
      </Column>
      <Column alignment="center" style={styles.card}>
        <Row alignment="center" spacing={12} style={styles.cardWidth}>
          <ProductBadge />
          <Column spacing={4} style={styles.product}>
            <AppText variant="footnote" color={colors.secondary}>
              PRIS
            </AppText>
            <AppText variant="headline">{intake.productName}</AppText>
          </Column>
        </Row>
      </Column>
      {feedback ? (
        <AppText variant="subhead" color={colors.danger}>
          {feedback}
        </AppText>
      ) : null}
      {error && !feedback ? (
        <AppText variant="subhead" color={colors.danger}>
          {error}
        </AppText>
      ) : null}
    </Screen>
  );
}
