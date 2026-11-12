import { Button, Column, Row, Spacer, TextInput, useNativeState } from "@expo/ui";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { formatAmount } from "@/features/routines/routine-name-schema";
import { useRecordIntake } from "@/features/intakes/useRecordIntake";
import { intakeQuantitySchema, parseIntakeQuantity } from "@/features/intakes/quantity";
import QuantityUnitPicker from "@/features/routines/components/QuantityUnitPicker";

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
      key={routine.id}
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

interface RecordRoutineIntakeFormProps {
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
}

function RecordRoutineIntakeForm({
  routine,
  today,
  colors,
  errorMessage,
  isActionDisabled,
  isSaving,
  recordIntake,
}: RecordRoutineIntakeFormProps) {
  const [isSelected, setIsSelected] = useState(false);
  const initialAmount = routine.quantity ? formatAmount(routine.quantity.amount) : "";
  const initialUnit = routine.quantity?.unit ?? "";

  const amountInput = useNativeState(initialAmount);

  const {
    control,
    handleSubmit,
    setValue,
    trigger,
    formState: { errors, isValid },
  } = useForm({
    defaultValues: { amount: initialAmount, unit: initialUnit },
    resolver: zodResolver(intakeQuantitySchema),
    mode: "onChange",
  });

  const form = routine.form ?? "";
  const unit = useWatch({ control, name: "unit" });

  const styles = useMemo(() => createStyles(colors, isSelected), [colors, isSelected]);

  const schedule = routineScheduleDisplay(routine);

  const save = async ({ amount, unit }: { amount: string; unit: string }) => {
    const quantity = parseIntakeQuantity(amount, unit);

    if (quantity === null) return;

    if (await recordIntake(routine.id, isSelected, quantity)) router.back();
  };

  return (
    <Screen
      grouped
      footer={
        <ActionButton
          label={isSaving ? "Saving…" : "Record intake"}
          onPress={() => void handleSubmit(save)()}
          disabled={!isSelected || isActionDisabled || !isValid}
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
              amountInput.set(value);
              setValue("amount", value);
              void trigger();
            }}
            keyboardType="decimal-pad"
            placeholder="Amount (optional)"
            style={styles.input}
            textStyle={styles.inputText}
            modifiers={fillAvailableWidth}
            testID="intake-quantity-amount"
          />
          <QuantityUnitPicker
            form={form}
            unit={unit}
            testID="intake-quantity-unit"
            onChangeUnit={(value) => {
              setValue("unit", value);
            }}
            onClearAmount={() => {
              amountInput.set("");
              setValue("amount", "");
            }}
            onValidate={() => void trigger()}
          />
          {errors.amount?.message ? (
            <Text variant="footnote" color={colors.danger}>
              {errors.amount.message}
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
