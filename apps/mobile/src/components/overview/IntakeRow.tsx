import { Button, Column, Row, Spacer } from "@expo/ui";
import { useMemo } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import type { Intake } from "@/routines/model";
import { timeLabel } from "@/routines/display";
import AppText from "@/components/ui/AppText";
import AppSymbol from "@/components/ui/AppSymbol";
import { fillAvailableWidth, fillParent } from "@/components/ui/layout";
import { usePalette } from "@/components/ui/palette";

export default function IntakeRow({ intake, onPress }: { intake: Intake; onPress: () => void }) {
  const colors = usePalette();
  const { fontScale } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Button style={styles.button} variant="text" onPress={onPress}>
      <Row alignment="center" modifiers={fillAvailableWidth} spacing={12} style={styles.row}>
        <Column alignment="center" style={styles.mark}>
          <AppSymbol name="checkmark" size={14} color={colors.background} />
        </Column>
        <Column spacing={2}>
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

function createStyles(colors: ReturnType<typeof usePalette>) {
  return StyleSheet.create({
    button: { width: fillParent },
    row: { paddingVertical: 12, backgroundColor: colors.grouped },
    mark: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.cyan },
  });
}
