import DateTimePicker from "@expo/ui/community/datetime-picker";
import { Column, RNHostView, Row, Spacer } from "@expo/ui";
import { StyleSheet, useColorScheme, useWindowDimensions } from "react-native";
import AppText from "./AppText";
import { usePalette } from "./palette";

export default function DateField({
  label,
  mode,
  value,
  onChange,
  testID,
}: {
  label: string;
  mode: "date" | "time";
  value: Date;
  onChange: (value: Date) => void;
  testID: string;
}) {
  const colors = usePalette();
  const scheme = useColorScheme() ?? "light";
  const { width, fontScale } = useWindowDimensions();

  const styles = StyleSheet.create({
    field: { width: width - 40, padding: 16, backgroundColor: colors.grouped, borderRadius: 24 },
    label: { width: width - (mode === "date" ? 230 : 180) },
  });

  const picker = (
    <RNHostView matchContents>
      <DateTimePicker
        mode={mode}
        value={value}
        display="compact"
        presentation="inline"
        locale="fr_FR"
        is24Hour
        themeVariant={scheme}
        accentColor={colors.blue}
        testID={testID}
        onValueChange={(_, next) => onChange(next)}
      />
    </RNHostView>
  );

  return fontScale > 1.3 ? (
    <Column spacing={12} style={styles.field}>
      <AppText>{label}</AppText>
      {picker}
    </Column>
  ) : (
    <Row alignment="center" spacing={12} style={styles.field}>
      <Column alignment="start" style={styles.label}>
        <AppText>{label}</AppText>
      </Column>
      <Spacer />
      {picker}
    </Row>
  );
}
