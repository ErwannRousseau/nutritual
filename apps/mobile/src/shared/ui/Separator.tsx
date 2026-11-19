import { Row } from "@expo/ui";
import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { fullWidth } from "@/shared/ui/layout";
import { usePalette } from "@/shared/ui/palette";

export default function Separator() {
  const { separator } = usePalette();
  const styles = useMemo(() => createStyles(separator), [separator]);

  return <Row style={styles.line} />;
}

function createStyles(backgroundColor: string) {
  return StyleSheet.create({
    line: { height: StyleSheet.hairlineWidth, backgroundColor, width: fullWidth },
  });
}
