import { Button, Column, Row, Spacer } from "@expo/ui";
import { useMemo } from "react";
import { StyleSheet } from "react-native";
import type { ReminderState, Routine } from "@/routines/model";
import AppText from "@/components/ui/AppText";
import AppSymbol from "@/components/ui/AppSymbol";
import ProductBadge from "@/components/ui/ProductBadge";
import { fillAvailableWidth, fillParent } from "@/components/ui/layout";
import { usePalette } from "@/components/ui/palette";

export default function UpcomingCard({
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

  const warning = reminder?.status === "denied" || reminder?.status === "failed";

  return (
    <Button style={styles.button} variant="text" onPress={onPress} testID={`record-${routine.id}`}>
      <Column modifiers={fillAvailableWidth} spacing={10} style={styles.card}>
        <Row modifiers={fillAvailableWidth} alignment="center">
          <AppText textStyle={styles.time}>
            {routine.frequency.kind === "as-needed" ? "À la demande" : routine.time}
          </AppText>
          <Spacer />
          <AppSymbol name="plus" size={24} color={colors.blue} />
        </Row>
        <Row alignment="center" spacing={12}>
          <ProductBadge />
          <Column spacing={4}>
            <AppText>{routine.productName}</AppText>
            {warning && (
              <AppText variant="footnote" color={colors.danger}>
                Rappel inactif
              </AppText>
            )}
          </Column>
        </Row>
      </Column>
    </Button>
  );
}

function createStyles(colors: ReturnType<typeof usePalette>) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.upcoming,
      borderRadius: 28,
      padding: 16,
    },
    button: { width: fillParent },
    time: { fontSize: 22, fontWeight: "700" },
  });
}
