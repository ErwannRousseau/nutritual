import DateTimePicker from "@expo/ui/community/datetime-picker";
import { Column, RNHostView, Row, Spacer } from "@expo/ui";
import { useMemo } from "react";
import { StyleSheet, useColorScheme, useWindowDimensions } from "react-native";
import Text from "@/shared/ui/Text";
import { fillParent } from "@/shared/ui/layout";
import { usePalette } from "@/shared/ui/palette";

interface DateFieldProps {
  label: string;
  mode: "date" | "time";
  value: Date;
  onChange: (value: Date) => void;
  testID: string;
}

export default function DateField({ label, mode, value, onChange, testID }: DateFieldProps) {
  const colors = usePalette();
  const scheme = useColorScheme() ?? "light";
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.3;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const picker = (
    <RNHostView matchContents>
      <DateTimePicker
        mode={mode}
        value={value}
        display="compact"
        presentation="inline"
        locale="en_GB"
        is24Hour
        themeVariant={scheme}
        accentColor={colors.blue}
        testID={testID}
        onValueChange={(_, next) => onChange(next)}
      />
    </RNHostView>
  );

  return largeText ? (
    <Column spacing={12} style={styles.field}>
      <Row alignment="center">
        <Text>{label}</Text>
        <Spacer />
      </Row>
      {picker}
    </Column>
  ) : (
    <Row alignment="center" spacing={12} style={styles.field}>
      <Text>{label}</Text>
      <Spacer />
      {picker}
    </Row>
  );
}

function createStyles(colors: ReturnType<typeof usePalette>) {
  return StyleSheet.create({
    field: {
      width: fillParent,
      padding: 16,
      backgroundColor: colors.grouped,
      borderRadius: 24,
    },
  });
}
