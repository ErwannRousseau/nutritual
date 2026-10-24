import { Button, Column, Row, Spacer } from "@expo/ui";
import { StyleSheet, useWindowDimensions } from "react-native";
import { AppSymbol, AppText, usePalette } from "../ui";

export default function ChoiceRow({
  label,
  selected,
  onPress,
  detail,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  detail?: string;
}) {
  const colors = usePalette();
  const { width } = useWindowDimensions();

  const styles = StyleSheet.create({
    row: { width: width - 72, paddingVertical: 12, backgroundColor: colors.grouped },
    content: { width: width - 118 },
    mark: { width: 18 },
  });

  return (
    <Button onPress={onPress} variant="text">
      <Row spacing={12} alignment="center" style={styles.row}>
        <Column spacing={3} style={styles.content}>
          <AppText>{label}</AppText>
          {detail && (
            <AppText variant="footnote" color={colors.secondary}>
              {detail}
            </AppText>
          )}
          {selected && (
            <AppText variant="footnote" color={colors.blue}>
              Sélectionné
            </AppText>
          )}
        </Column>
        <Spacer />
        <Column style={styles.mark}>
          {selected && <AppSymbol name="checkmark" size={18} color={colors.blue} />}
        </Column>
      </Row>
    </Button>
  );
}
