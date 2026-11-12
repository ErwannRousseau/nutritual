import { useMemo, useState } from "react";
import { Button, Column, Picker, Row, Spacer, TextInput, useNativeState } from "@expo/ui";
import { StyleSheet, useWindowDimensions } from "react-native";
import Text from "@/shared/ui/Text";
import { fillAvailableWidth } from "@/shared/ui/layout";
import { usePalette } from "@/shared/ui/palette";
import { customOption } from "@/features/routines/picker-options";
import { units, unitOptions } from "@/features/routines/product-units";

interface QuantityUnitPickerProps {
  form: string;
  amount: string;
  unit: string;
  onChangeUnit: (value: string) => void;
  onClearAmount: () => void;
  onValidate?: () => void;
  testID: string;
  customTestID?: string;
}

export default function QuantityUnitPicker({
  form,
  amount,
  unit,
  onChangeUnit,
  onClearAmount,
  onValidate,
  testID,
  customTestID,
}: QuantityUnitPickerProps) {
  const colors = usePalette();
  const { fontScale } = useWindowDimensions();
  const unitInput = useNativeState(unit);

  const [customUnit, setCustomUnit] = useState(
    Boolean(unit && !units.some((value) => value.toLowerCase() === unit.toLowerCase())),
  );

  const styles = useMemo(() => createStyles(colors, fontScale), [colors, fontScale]);

  const selectedUnit = customUnit
    ? customOption
    : (units.find((value) => value.toLowerCase() === unit.toLowerCase()) ?? "");

  function handleUnitChange(value: string) {
    if (value !== customOption) {
      setCustomUnit(false);
      onChangeUnit(value);
      unitInput.set(value);
    } else {
      if (!customUnit) {
        onChangeUnit("");
        unitInput.set("");
      }

      setCustomUnit(true);
    }

    onValidate?.();
  }

  function handleCustomUnitChange(value: string) {
    onChangeUnit(value);
    unitInput.set(value);
    onValidate?.();
  }

  function clearAmount() {
    setCustomUnit(false);
    unitInput.set("");
    onChangeUnit("");
    onClearAmount();
    onValidate?.();
  }

  return (
    <Column spacing={8} modifiers={fillAvailableWidth}>
      <Row spacing={12} alignment="center" style={styles.pickerRow} modifiers={fillAvailableWidth}>
        <Text variant="body" color={colors.secondary}>
          Unit
        </Text>
        <Spacer />
        <Picker
          appearance="menu"
          selectedValue={selectedUnit}
          testID={testID}
          onValueChange={handleUnitChange}
        >
          <Picker.Item label="Select unit" value="" />
          {unitOptions(form).map((value) => (
            <Picker.Item key={value} label={value} value={value} />
          ))}
          <Picker.Item label="Other…" value={customOption} />
        </Picker>
      </Row>
      {customUnit ? (
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          value={unitInput}
          onChangeText={handleCustomUnitChange}
          placeholder="Other unit"
          maxLength={40}
          style={styles.input}
          textStyle={styles.inputText}
          modifiers={fillAvailableWidth}
          testID={customTestID ?? `${testID}-custom`}
        />
      ) : null}
      {amount || unit ? (
        <Button variant="text" onPress={clearAmount} testID={`${testID}-clear`}>
          <Text color={colors.blue}>Clear amount</Text>
        </Button>
      ) : null}
    </Column>
  );
}

function createStyles(colors: ReturnType<typeof usePalette>, fontScale: number) {
  return StyleSheet.create({
    input: { padding: 16, borderRadius: 28, backgroundColor: colors.grouped },
    inputText: { color: colors.text, fontSize: 17 * fontScale },
    pickerRow: { padding: 14, borderRadius: 20, backgroundColor: colors.grouped },
  });
}
