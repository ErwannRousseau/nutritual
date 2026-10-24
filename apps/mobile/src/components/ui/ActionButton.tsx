import { Button as UniversalButton, Column } from "@expo/ui";
import { StyleSheet, useWindowDimensions } from "react-native";
import AppText from "./AppText";
import { usePalette } from "./palette";

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
  const { width } = useWindowDimensions();
  const colors = usePalette();
  const foreground = kind === "secondary" ? colors.blue : "#FFFFFF";

  const background =
    kind === "secondary" ? colors.grouped : kind === "destructive" ? "#D92D20" : "#006AD8";

  const styles = StyleSheet.create({
    button: { width: width - 40 },
    label: {
      backgroundColor: background,
      borderRadius: 26,
      paddingHorizontal: 20,
      paddingVertical: 14,
      opacity: disabled ? 0.45 : 1,
      width: width - 40,
    },
    labelText: { color: foreground, fontSize: 17, fontWeight: "600", textAlign: "center" },
  });

  return (
    <UniversalButton
      disabled={disabled}
      onPress={onPress}
      style={styles.button}
      testID={testID}
      variant="text"
    >
      <Column alignment="center" style={styles.label}>
        <AppText variant="headline" textStyle={styles.labelText}>
          {label}
        </AppText>
      </Column>
    </UniversalButton>
  );
}
