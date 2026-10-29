import { Button, Column, Row, Spacer } from "@expo/ui";
import { useMemo } from "react";
import { StyleSheet } from "react-native";
import type { ReminderState, Routine } from "@/features/routines/model";
import { routineScheduleDisplay } from "@/features/routines/display";
import Text from "@/shared/ui/Text";
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
          <Text variant="headline">{routine.productName}</Text>
          <Text variant="subhead" color={colors.secondary}>
            {routineScheduleDisplay(routine).label}
          </Text>
          {routine.paused && (
            <Text variant="footnote" color={colors.secondary}>
              Paused
            </Text>
          )}
          {!routine.paused &&
            (reminder?.status === ReminderOutcomes.denied ||
              reminder?.status === ReminderOutcomes.failed) && (
              <Text variant="footnote" color={colors.danger}>
                Routine saved · Reminder inactive
              </Text>
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
