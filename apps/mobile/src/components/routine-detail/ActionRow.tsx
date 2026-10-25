import { Button, Column, Row, Spacer } from "@expo/ui";
import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { AppSymbol, AppText, fillAvailableWidth, fillParent, usePalette } from "@/components/ui";
import type { AppSymbolName } from "@/components/ui";

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
