import { Button, Column, Row } from "@expo/ui";
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
import { useRoutineStore } from "../../routines/RoutinesProvider";
import SheetHeader from "../../components/ui/SheetHeader";
import { dateLabel, frequencyLabel, timeLabel } from "../../routines/display";

export default function RecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { routines, busy, error, record } = useRoutineStore();
  const colors = usePalette();
  const { width } = useWindowDimensions();
  const [today] = useState(() => new Date());
  const [selected, setSelected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const routine = routines.find((item) => item.id === id);
  const contentWidth = width - 40;
  const cardWidth = contentWidth - 40;
  const productWidth = cardWidth - 52;

  const schedule = routine
    ? routine.frequency.kind === "as-needed"
      ? frequencyLabel(routine.frequency)
      : `${timeLabel(new Date(`2000-01-01T${routine.time}:00`))} · ${frequencyLabel(routine.frequency)}`
    : "";

  const styles = StyleSheet.create({
    content: { width: contentWidth },
    heroTitle: { width: contentWidth },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.separator,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 20,
      width: contentWidth,
    },
    cardRow: { width: cardWidth },
    product: { width: productWidth },
    selectButton: {
      backgroundColor: selected ? colors.upcoming : colors.grouped,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 20,
      width: cardWidth,
    },
    centeredText: { textAlign: "center" },
  });

  async function save() {
    if (!routine || !selected || busy || saving) return;
    setSaving(true);
    setFeedback(null);

    try {
      if (await record(routine.id)) router.back();
      else setFeedback(error ?? "Impossible d’enregistrer la prise. Réessayez.");
    } catch {
      setFeedback("Impossible d’enregistrer la prise. Réessayez.");
    } finally {
      setSaving(false);
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
          label={saving ? "Enregistrement…" : "Enregistrer la prise"}
          onPress={() => void save()}
          disabled={!selected || busy || saving}
        />
      }
    >
      <SheetHeader title={dateLabel(today)} />
      <Column alignment="center" spacing={14} style={styles.content}>
        <ProductBadge size={96} />
        <AppText variant="largeTitle" style={styles.heroTitle} textStyle={styles.centeredText}>
          {routine.frequency.kind === "as-needed"
            ? "À la demande"
            : `Prise de ${schedule.split(" · ")[0]}`}
        </AppText>
      </Column>
      <Column alignment="center" spacing={16} style={styles.card}>
        <Row alignment="center" spacing={12} style={styles.cardRow}>
          <ProductBadge />
          <Column alignment="start" spacing={5} style={styles.product}>
            <AppText variant="headline">{routine.productName}</AppText>
            <AppText variant="footnote" color={colors.secondary} style={styles.product}>
              {schedule}
            </AppText>
          </Column>
        </Row>
        <Button
          disabled={busy || saving}
          onPress={() => setSelected((value) => !value)}
          style={styles.selectButton}
          testID="select-intake"
          variant="text"
        >
          <Row alignment="center" spacing={8}>
            <AppSymbol name="checkmark" color={selected ? colors.blue : colors.secondary} />
            <AppText variant="headline" color={selected ? colors.blue : colors.text}>
              {selected ? "Pris · sélectionné" : "Pris"}
            </AppText>
          </Row>
        </Button>
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
