import { Button, Column, Row, Spacer } from "@expo/ui";
import { useMemo } from "react";
import { StyleSheet } from "react-native";
import type { ReminderState, Routine } from "@/routines/model";
import { frequencyLabel } from "@/routines/display";
import AppText from "@/components/ui/AppText";
import AppSymbol from "@/components/ui/AppSymbol";
import ProductBadge from "@/components/ui/ProductBadge";
import { fillAvailableWidth, fillParent } from "@/components/ui/layout";
import { usePalette } from "@/components/ui/palette";
import { FrequencyKind, ReminderOutcomes } from "@nutritual/protocol";

export default function RoutineRow({
  routine,
  reminder,
  onPress,
}: {
  routine: Routine;
  reminder?: ReminderState;
  onPress: () => void;
}) {
  const colors = usePalette();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Button style={styles.button} variant="text" onPress={onPress}>
      <Row alignment="center" modifiers={fillAvailableWidth} spacing={12} style={styles.row}>
        <ProductBadge />
        <Column spacing={4}>
          <AppText variant="headline">{routine.productName}</AppText>
          <AppText variant="subhead" color={colors.secondary}>
            {routine.frequency.kind === FrequencyKind.asNeeded
              ? "À la demande"
              : `${routine.time} · ${frequencyLabel(routine.frequency)}`}
          </AppText>
          {routine.paused && (
            <AppText variant="footnote" color={colors.secondary}>
              En pause
            </AppText>
          )}
          {!routine.paused &&
            (reminder?.status === ReminderOutcomes.denied ||
              reminder?.status === ReminderOutcomes.failed) && (
              <AppText variant="footnote" color={colors.danger}>
                Routine enregistrée · Rappel inactif
              </AppText>
            )}
        </Column>
        <Spacer />
        <AppSymbol name="chevron.right" size={14} color={colors.secondary} />
      </Row>
    </Button>
  );
}

function createStyles(colors: ReturnType<typeof usePalette>) {
  return StyleSheet.create({
    button: { width: fillParent },
    row: { paddingVertical: 14, backgroundColor: colors.grouped },
  });
}
