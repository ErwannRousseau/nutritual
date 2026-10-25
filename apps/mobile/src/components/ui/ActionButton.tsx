import { Button, Column } from "@expo/ui";
import { useMemo } from "react";
import { StyleSheet } from "react-native";
import AppText from "@/components/ui/AppText";
import { fillAvailableWidth, fillParent } from "@/components/ui/layout";
import { usePalette } from "@/components/ui/palette";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  kind?: "primary" | "secondary" | "destructive";
};

export default function ActionButton({
  label,
  onPress,
  disabled = false,
  testID,
  kind = "primary",
}: Props) {
  const colors = usePalette();
  const foreground = kind === "secondary" ? colors.blue : "#FFFFFF";

  const background =
    kind === "secondary" ? colors.grouped : kind === "destructive" ? "#D92D20" : "#006AD8";

  const styles = useMemo(
    () => createStyles(background, foreground, disabled),
    [background, disabled, foreground],
  );

  return (
    <Button
      disabled={disabled}
      modifiers={fillAvailableWidth}
      onPress={onPress}
      testID={testID}
      variant="text"
    >
      <Column alignment="center" style={styles.label} modifiers={fillAvailableWidth}>
        <AppText variant="headline" textStyle={styles.labelText}>
          {label}
        </AppText>
      </Column>
    </Button>
  );
}

function createStyles(background: string, foreground: string, disabled: boolean) {
  return StyleSheet.create({
    label: {
      backgroundColor: background,
      borderRadius: 26,
      paddingHorizontal: 20,
      paddingVertical: 14,
      opacity: disabled ? 0.45 : 1,
      width: fillParent,
    },
    labelText: { color: foreground, fontSize: 17, fontWeight: "600", textAlign: "center" },
  });
}
