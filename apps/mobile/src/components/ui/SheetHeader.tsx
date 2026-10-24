import { Column, Row } from "@expo/ui";
import { router } from "expo-router";
import { StyleSheet, useWindowDimensions } from "react-native";
import AppText from "./AppText";
import IconButton from "./IconButton";
import { usePalette } from "./palette";

export default function SheetHeader({ title }: { title: string }) {
  const { width } = useWindowDimensions();
  const colors = usePalette();

  const styles = StyleSheet.create({
    row: { width: width - 40 },
    close: { backgroundColor: colors.surface, borderRadius: 22 },
    title: { width: width - 128 },
    centered: { textAlign: "center" },
    spacer: { width: 44 },
  });

  return (
    <Row alignment="center" style={styles.row}>
      <Column style={styles.close}>
        <IconButton name="xmark" label="Fermer" onPress={() => router.back()} />
      </Column>
      <AppText variant="subhead" style={styles.title} textStyle={styles.centered}>
        {title}
      </AppText>
      <Column style={styles.spacer} />
    </Row>
  );
}
