import { Column, Row, Spacer } from "@expo/ui";
import { router } from "expo-router";
import { useMemo } from "react";
import { StyleSheet } from "react-native";
import AppText from "@/shared/ui/AppText";
import IconButton from "@/shared/ui/IconButton";
import { fillParent, sixtyPercent } from "@/shared/ui/layout";
import { usePalette } from "@/shared/ui/palette";

export default function SheetHeader({ title }: { title: string }) {
  const colors = usePalette();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Row alignment="center" style={styles.row}>
      <Column style={styles.close}>
        <IconButton name="xmark" label="Close" onPress={() => router.back()} />
      </Column>
      <Spacer flexible />
      <AppText variant="subhead" style={styles.title} textStyle={styles.centered}>
        {title}
      </AppText>
      <Spacer flexible />
      <Column style={styles.spacer} />
    </Row>
  );
}

function createStyles(colors: ReturnType<typeof usePalette>) {
  return StyleSheet.create({
    row: { width: fillParent },
    close: { backgroundColor: colors.surface, borderRadius: 22 },
    title: { width: sixtyPercent },
    centered: { textAlign: "center" },
    spacer: { width: 44 },
  });
}
