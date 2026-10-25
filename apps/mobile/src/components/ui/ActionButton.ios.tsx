import { RNHostView } from "@expo/ui/swift-ui";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
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
    <RNHostView matchContents={{ vertical: true }}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        testID={testID}
        style={styles.button}
      >
        <Text style={styles.label}>{label}</Text>
      </Pressable>
    </RNHostView>
  );
}

function createStyles(background: string, foreground: string, disabled: boolean) {
  return StyleSheet.create({
    button: {
      alignItems: "center",
      backgroundColor: background,
      borderRadius: 26,
      opacity: disabled ? 0.45 : 1,
      paddingHorizontal: 20,
      paddingVertical: 14,
      width: "100%",
    },
    label: { color: foreground, fontSize: 17, fontWeight: "600", textAlign: "center" },
  });
}
