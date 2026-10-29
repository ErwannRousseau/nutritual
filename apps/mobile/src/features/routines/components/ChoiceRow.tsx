import { Button, Column, Row, Spacer } from "@expo/ui";
import { useMemo } from "react";
import { StyleSheet } from "react-native";
import AppSymbol from "@/shared/ui/AppSymbol";
import Text from "@/shared/ui/Text";
import { fillAvailableWidth, fillParent } from "@/shared/ui/layout";
import { usePalette } from "@/shared/ui/palette";

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
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Button style={styles.button} onPress={onPress} variant="text">
      <Row modifiers={fillAvailableWidth} spacing={12} alignment="center" style={styles.row}>
        <Column spacing={3}>
          <Text>{label}</Text>
          {detail && (
            <Text variant="footnote" color={colors.secondary}>
              {detail}
            </Text>
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

function createStyles(colors: ReturnType<typeof usePalette>) {
  return StyleSheet.create({
    button: { width: fillParent },
    row: { paddingVertical: 12, backgroundColor: colors.grouped },
    mark: { width: 18 },
  });
}
