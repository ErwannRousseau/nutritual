import { Button, Column, Row, Spacer, TextInput, useNativeState } from "@expo/ui";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import ActionButton from "@/shared/ui/ActionButton";
import AppSymbol from "@/shared/ui/AppSymbol";
import Text from "@/shared/ui/Text";
import { centerAvailableWidth, fillAvailableWidth, fillParent } from "@/shared/ui/layout";
import SheetHeader from "@/shared/ui/SheetHeader";
import ProductBadge from "@/shared/ui/ProductBadge";
import Screen from "@/shared/ui/Screen";
import { usePalette } from "@/shared/ui/palette";
import { dateLabel, routineScheduleDisplay } from "@/features/routines/display";
import { useRecordIntake } from "@/features/intakes/useRecordIntake";
import { parseIntakeQuantity } from "@/features/intakes/quantity";

export default function RecordIntakeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { routines, busy, error, isSaving, isActionDisabled, feedback, recordIntake } =
    useRecordIntake();

  const colors = usePalette();
  const [today] = useState(() => new Date());
  const routine = routines.find((item) => item.id === id);
  const errorMessage = feedback ?? error;

  if (!routine) {
    return (
      <Screen grouped>
        <Text color={error ? colors.danger : colors.text}>
          {busy ? "Loading routine…" : (error ?? "Routine not found.")}
        </Text>
        {!busy ? (
          <ActionButton kind="secondary" label="Close" onPress={() => router.back()} />
        ) : null}
      </Screen>
    );
  }

  return (
    <RecordRoutineIntakeForm
      routine={routine}
      today={today}
      colors={colors}
      errorMessage={errorMessage}
      isActionDisabled={isActionDisabled}
      isSaving={isSaving}
      recordIntake={recordIntake}
    />
  );
}

function RecordRoutineIntakeForm({
  routine,
  today,
  colors,
  errorMessage,
  isActionDisabled,
  isSaving,
  recordIntake,
}: {
  routine: NonNullable<ReturnType<typeof useRecordIntake>["routines"][number]>;
  today: Date;
  colors: ReturnType<typeof usePalette>;
  errorMessage: string | null;
  isActionDisabled: boolean;
  isSaving: boolean;
  recordIntake: (
    id: string,
    selected: boolean,
    quantity?: { amount: number; unit: string },
  ) => Promise<boolean>;
}) {
  const [isSelected, setIsSelected] = useState(false);
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("");
  const amountInput = useNativeState("");
  const unitInput = useNativeState("");
  const edited = useRef(false);
  const currentRoutineId = useRef(routine.id);

  const styles = useMemo(() => createStyles(colors, isSelected), [colors, isSelected]);

  useEffect(() => {
    if (currentRoutineId.current !== routine.id) {
      currentRoutineId.current = routine.id;
      edited.current = false;
    }

    if (!edited.current) {
      const nextAmount = routine.quantity ? String(routine.quantity.amount) : "";

      const nextUnit = routine.quantity?.unit ?? "";
      setAmount(nextAmount);
      setUnit(nextUnit);
      amountInput.set(nextAmount);
      unitInput.set(nextUnit);
    }
  }, [amountInput, routine.id, routine.quantity, unitInput]);

  const schedule = routineScheduleDisplay(routine);

  const save = async () => {
    const quantity = parseIntakeQuantity(amount, unit);

    if (quantity === null) return;

    if (await recordIntake(routine.id, isSelected, quantity)) router.back();
  };

  const quantityInvalid = parseIntakeQuantity(amount, unit) === null;

  return (
    <Screen
      grouped
      footer={
        <ActionButton
          label={isSaving ? "Saving…" : "Record intake"}
          onPress={() => void save()}
          disabled={!isSelected || isActionDisabled || quantityInvalid}
        />
      }
    >
      <SheetHeader title={dateLabel(today)} />
      <Row alignment="center">
        <Column alignment="center" spacing={14} style={styles.content}>
          <ProductBadge size={96} />
          <Text
            modifiers={centerAvailableWidth}
            variant="largeTitle"
            textStyle={styles.centeredText}
          >
            {schedule.time ? `Intake at ${schedule.time}` : "As needed"}
          </Text>
        </Column>
        <Spacer />
      </Row>
      <Row alignment="center">
        <Column alignment="center" spacing={16} style={styles.card}>
          <Row alignment="center" modifiers={fillAvailableWidth} spacing={12}>
            <ProductBadge />
            <Column alignment="start" spacing={5}>
              <Text variant="headline">{routine.productName}</Text>
              <Text variant="footnote" color={colors.secondary}>
                {schedule.label}
              </Text>
            </Column>
            <Spacer />
          </Row>
          <Button
            disabled={isActionDisabled}
            onPress={() => setIsSelected((value) => !value)}
            style={styles.selectButton}
            testID="select-intake"
            variant="text"
          >
            <Row alignment="center" spacing={8}>
              <Spacer />
              <AppSymbol name="checkmark" color={isSelected ? colors.blue : colors.secondary} />
              <Text variant="headline" color={isSelected ? colors.blue : colors.text}>
                Pris
              </Text>
              <Spacer />
            </Row>
          </Button>
          <TextInput
            value={amountInput}
            onChangeText={(value) => {
              edited.current = true;
              amountInput.set(value);
              setAmount(value);
            }}
            keyboardType="decimal-pad"
            placeholder="Amount (optional)"
            maxLength={16}
            style={styles.input}
            textStyle={styles.inputText}
            modifiers={fillAvailableWidth}
            testID="intake-quantity-amount"
          />
          <TextInput
            value={unitInput}
            onChangeText={(value) => {
              edited.current = true;
              unitInput.set(value);
              setUnit(value);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Unit (optional)"
            maxLength={40}
            style={styles.input}
            textStyle={styles.inputText}
            modifiers={fillAvailableWidth}
            testID="intake-quantity-unit"
          />
          {quantityInvalid ? (
            <Text variant="footnote" color={colors.danger}>
              Enter a positive amount and its unit, or clear both fields.
            </Text>
          ) : null}
        </Column>
        <Spacer />
      </Row>
      {errorMessage ? (
        <Text variant="subhead" color={colors.danger}>
          {errorMessage}
        </Text>
      ) : null}
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof usePalette>, isSelected: boolean) {
  return StyleSheet.create({
    content: { width: fillParent },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.separator,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 20,
      width: fillParent,
    },
    selectButton: {
      backgroundColor: isSelected ? colors.upcoming : colors.grouped,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 20,
      width: fillParent,
    },
    centeredText: { textAlign: "center" },
    input: {
      padding: 14,
      borderRadius: 18,
      backgroundColor: colors.grouped,
      width: fillParent,
    },
    inputText: { color: colors.text, fontSize: 17 },
  });
}
