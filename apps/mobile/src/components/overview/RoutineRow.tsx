import { Button, Column, Row, Spacer } from "@expo/ui";
import { StyleSheet, useWindowDimensions } from "react-native";
import type { ReminderState, Routine } from "../../routines/model";
import { frequencyLabel } from "../../routines/display";
import AppText from "../ui/AppText";
import AppSymbol from "../ui/AppSymbol";
import ProductBadge from "../ui/ProductBadge";
import { usePalette } from "../ui/palette";

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
  const { width } = useWindowDimensions();

  const styles = StyleSheet.create({
    row: { width: width - 72, paddingVertical: 14, backgroundColor: colors.grouped },
    name: { width: width - 174 },
  });

  return (
    <Button variant="text" onPress={onPress}>
      <Row alignment="center" spacing={12} style={styles.row}>
        <ProductBadge />
        <Column spacing={4} style={styles.name}>
          <AppText variant="headline">{routine.productName}</AppText>
          <AppText variant="subhead" color={colors.secondary}>
            {routine.frequency.kind === "as-needed"
              ? "À la demande"
              : `${routine.time} · ${frequencyLabel(routine.frequency)}`}
          </AppText>
          {routine.paused && (
            <AppText variant="footnote" color={colors.secondary}>
              En pause
            </AppText>
          )}
          {!routine.paused && (reminder?.status === "denied" || reminder?.status === "failed") && (
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
