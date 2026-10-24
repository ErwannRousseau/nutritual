import { Button, Column, Row, Spacer } from "@expo/ui";
import { StyleSheet, useWindowDimensions } from "react-native";
import { AppSymbol, AppText, usePalette } from "../ui";
import type { AppSymbolName } from "../ui";

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
  const { width } = useWindowDimensions();
  const contentWidth = width - 76;

  const styles = StyleSheet.create({
    row: { backgroundColor: colors.surface, paddingVertical: 14, width: contentWidth },
    label: { width: contentWidth - 76 },
  });

  return (
    <Button disabled={disabled} onPress={onPress} testID={`routine-action-${icon}`} variant="text">
      <Row alignment="center" spacing={12} style={styles.row}>
        <AppSymbol name={icon} color={destructive ? colors.danger : colors.blue} />
        <Column alignment="start" style={styles.label}>
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
