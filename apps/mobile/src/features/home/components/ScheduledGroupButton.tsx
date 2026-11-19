import { Button, Column } from "@expo/ui";
import { background, cornerRadius } from "@expo/ui/swift-ui/modifiers";
import { fillContainerWidth } from "@/shared/ui/layout";
import type { PropsWithChildren } from "react";
import { StyleSheet } from "react-native";

export interface ScheduledGroupButtonProps extends PropsWithChildren {
  backgroundColor: string;
  onPress: () => void;
}

export default function ScheduledGroupButton({
  backgroundColor,
  children,
  onPress,
}: ScheduledGroupButtonProps) {
  return (
    <Button variant="text" onPress={onPress}>
      <Column
        spacing={8}
        style={styles.content}
        modifiers={[...(fillContainerWidth ?? []), background(backgroundColor), cornerRadius(28)]}
      >
        {children}
      </Column>
    </Button>
  );
}

const styles = StyleSheet.create({ content: { padding: 16 } });
