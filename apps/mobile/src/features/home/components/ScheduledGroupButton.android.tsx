/* oxlint-disable anti-slop/no-shape-in-symbol-names */
import { Column } from "@expo/ui";
import { StyleSheet } from "react-native";
import { fillContainerWidth } from "@/shared/ui/layout";
import { Shape, TextButton } from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import type { ScheduledGroupButtonProps } from "./ScheduledGroupButton";

export default function ScheduledGroupButton({
  backgroundColor,
  children,
  onPress,
}: ScheduledGroupButtonProps) {
  return (
    <TextButton
      onClick={onPress}
      colors={{ containerColor: backgroundColor }}
      contentPadding={{ start: 0, top: 0, end: 0, bottom: 0 }}
      modifiers={[fillMaxWidth()]}
      shape={roundedCorners}
    >
      <Column spacing={8} style={styles.content} modifiers={fillContainerWidth}>
        {children}
      </Column>
    </TextButton>
  );
}

const roundedCorners = Shape.RoundedCorner({
  cornerRadii: { topStart: 28, topEnd: 28, bottomStart: 28, bottomEnd: 28 },
});

const styles = StyleSheet.create({ content: { padding: 16 } });
