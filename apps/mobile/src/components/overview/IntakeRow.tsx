import { Button, Column, Row, Spacer } from "@expo/ui";
import { StyleSheet, useWindowDimensions } from "react-native";
import type { Intake } from "../../routines/model";
import { timeLabel } from "../../routines/display";
import AppText from "../ui/AppText";
import AppSymbol from "../ui/AppSymbol";
import { usePalette } from "../ui/palette";

export default function IntakeRow({ intake, onPress }: { intake: Intake; onPress: () => void }) {
  const colors = usePalette();
  const { width, fontScale } = useWindowDimensions();

  const styles = StyleSheet.create({
    row: { paddingVertical: 12, width: width - 72, backgroundColor: colors.grouped },
    name: { width: width - (fontScale > 1.3 ? 136 : 200) },
    mark: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.cyan },
  });

  return (
    <Button variant="text" onPress={onPress}>
      <Row alignment="center" spacing={12} style={styles.row}>
        <Column alignment="center" style={styles.mark}>
          <AppSymbol name="checkmark" size={14} color={colors.background} />
        </Column>
        <Column spacing={2} style={styles.name}>
          <AppText>{intake.productName}</AppText>
          {fontScale > 1.3 && (
            <AppText variant="subhead" color={colors.secondary}>
              {timeLabel(new Date(intake.recordedAt))}
            </AppText>
          )}
        </Column>
        <Spacer />
        {fontScale <= 1.3 && (
          <AppText variant="subhead" color={colors.secondary}>
            {timeLabel(new Date(intake.recordedAt))}
          </AppText>
        )}
        <AppSymbol name="chevron.right" size={12} color={colors.secondary} />
      </Row>
    </Button>
  );
}
