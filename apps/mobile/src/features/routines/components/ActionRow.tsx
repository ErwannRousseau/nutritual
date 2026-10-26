import { Button, Column, Row, Spacer } from "@expo/ui";
import { useMemo } from "react";
import { StyleSheet } from "react-native";
import AppSymbol from "@/shared/ui/AppSymbol";
import AppText from "@/shared/ui/AppText";
import { fillAvailableWidth, fillParent } from "@/shared/ui/layout";
import { usePalette } from "@/shared/ui/palette";
import type { AppSymbolName } from "@/shared/ui/AppSymbol";

type Props = {
  label: string;
  icon: AppSymbolName;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

export default function ActionRow({
  label,
  icon,
  onPress,
  destructive = false,
  disabled = false,
}: Props) {
  const colors = usePalette();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Button
      disabled={disabled}
      style={styles.button}
      onPress={onPress}
      testID={`routine-action-${icon}`}
      variant="text"
    >
      <Row alignment="center" modifiers={fillAvailableWidth} spacing={12} style={styles.row}>
        <AppSymbol name={icon} color={destructive ? colors.danger : colors.blue} />
        <Column alignment="start">
          <AppText variant="body" color={destructive ? colors.danger : colors.text}>
            {label}
          </AppText>
        </Column>
        <Spacer />
        <AppSymbol name="chevron.right" size={16} color={colors.secondary} />
      </Row>
    </Button>
  );
}

function createStyles(colors: ReturnType<typeof usePalette>) {
  return StyleSheet.create({
    button: { width: fillParent },
    row: { backgroundColor: colors.surface, paddingVertical: 14 },
  });
}
