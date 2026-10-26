import { Button, Column, Row, Spacer } from "@expo/ui";
import { useMemo } from "react";
import { StyleSheet } from "react-native";
import type { ReminderState, Routine } from "@/features/routines/model";
import { routineScheduleDisplay } from "@/features/routines/display";
import AppText from "@/shared/ui/AppText";
import AppSymbol from "@/shared/ui/AppSymbol";
import ProductBadge from "@/shared/ui/ProductBadge";
import { fillAvailableWidth, fillParent } from "@/shared/ui/layout";
import { usePalette } from "@/shared/ui/palette";
import { ReminderOutcomes } from "@nutritual/protocol";

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
            {routineScheduleDisplay(routine).label}
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
