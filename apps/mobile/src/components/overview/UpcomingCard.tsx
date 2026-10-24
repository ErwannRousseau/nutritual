import { Button, Column, Row, Spacer } from "@expo/ui";
import { StyleSheet, useWindowDimensions } from "react-native";
import type { ReminderState, Routine } from "../../routines/model";
import AppText from "../ui/AppText";
import AppSymbol from "../ui/AppSymbol";
import ProductBadge from "../ui/ProductBadge";
import { usePalette } from "../ui/palette";

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
  const { width } = useWindowDimensions();

  const styles = StyleSheet.create({
    card: { backgroundColor: colors.upcoming, borderRadius: 28, padding: 16, width: width - 40 },
    row: { width: width - 72 },
    name: { width: width - 128 },
    time: { fontSize: 22, fontWeight: "700" },
  });

  const warning = reminder?.status === "denied" || reminder?.status === "failed";

  return (
    <Button variant="text" onPress={onPress} testID={`record-${routine.id}`}>
      <Column spacing={10} style={styles.card}>
        <Row alignment="center" style={styles.row}>
          <AppText textStyle={styles.time}>
            {routine.frequency.kind === "as-needed" ? "À la demande" : routine.time}
          </AppText>
          <Spacer />
          <AppSymbol name="plus" size={24} color={colors.blue} />
        </Row>
        <Row alignment="center" spacing={12} style={styles.row}>
          <ProductBadge />
          <Column style={styles.name} spacing={4}>
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
