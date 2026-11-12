import { useMemo, useState } from "react";
import { Column, Picker, Row, Spacer, useNativeState } from "@expo/ui";
import { TextInput } from "@expo/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, useWindowDimensions } from "react-native";
import ActionButton from "@/shared/ui/ActionButton";
import Text from "@/shared/ui/Text";
import { fillAvailableWidth, fillContainerWidth, fillParent } from "@/shared/ui/layout";
import ProductBadge from "@/shared/ui/ProductBadge";
import Screen from "@/shared/ui/Screen";
import { usePalette } from "@/shared/ui/palette";
import { useRoutineDraft } from "@/features/routines/RoutineDraftProvider";
import { useRoutineStore } from "@/features/routines/RoutinesProvider";
import {
  formatAmount,
  positiveAmountSchema,
  routineNameSchema,
  type RoutineNameFields,
} from "@/features/routines/routine-name-schema";
import type { RoutineDraft } from "@/features/routines/model";

const forms = ["Capsule", "Tablet", "Lozenge", "Gummy", "Powder", "Liquid", "Drops"] as const;

const units = [
  "capsule",
  "tablet",
  "lozenge",
  "gummy",
  "drop",
  "microgram",
  "milligram",
  "gram",
  "millilitre",
  "litre",
  "scoop",
  "teaspoon",
  "tablespoon",
  "spray",
];

const relatedUnits = {
  Capsule: ["capsule"],
  Tablet: ["tablet"],
  Lozenge: ["lozenge"],
  Gummy: ["gummy"],
  Powder: ["gram", "scoop", "teaspoon", "tablespoon"],
  Liquid: ["millilitre", "litre", "teaspoon", "tablespoon"],
  Drops: ["drop"],
} satisfies Record<(typeof forms)[number], string[]>;

const customOption = "__custom__";

export default function RoutineNameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { draft, setDraft, ready, missing, markDirty } = useRoutineDraft();
  const { error, reload } = useRoutineStore();
  const colors = usePalette();

  if (!ready || !draft) {
    return (
      <Screen>
        <Text variant="title">{missing ? "Routine not found" : "Loading…"}</Text>
        {missing ? (
          <ActionButton label="Close" onPress={() => router.dismissAll()} kind="secondary" />
        ) : error ? (
          <>
            <Text variant="body" color={colors.secondary}>
              {error}
            </Text>
            <ActionButton label="Try again" onPress={() => void reload()} kind="secondary" />
          </>
        ) : null}
      </Screen>
    );
  }

  return (
    <RoutineNameForm
      id={id}
      draft={draft}
      setDraft={setDraft}
      markDirty={markDirty}
      error={error}
    />
  );
}

function RoutineNameForm({
  id,
  draft,
  setDraft,
  markDirty,
  error,
}: {
  id: string;
  draft: RoutineDraft;
  setDraft: (draft: RoutineDraft) => void;
  markDirty: () => void;
  error: string | null;
}) {
  const colors = usePalette();
  const { fontScale } = useWindowDimensions();
  const initialForm = draft.form ?? "";
  const initialAmount = draft.quantity ? formatAmount(draft.quantity.amount) : "";
  const initialUnit = draft.quantity?.unit ?? "";

  const nameInput = useNativeState(draft.productName);
  const formInput = useNativeState(initialForm);
  const amountInput = useNativeState(initialAmount);
  const unitInput = useNativeState(initialUnit);

  const [customForm, setCustomForm] = useState(
    Boolean(
      initialForm && !forms.some((value) => value.toLowerCase() === initialForm.toLowerCase()),
    ),
  );

  const [customUnit, setCustomUnit] = useState(
    Boolean(
      initialUnit && !units.some((value) => value.toLowerCase() === initialUnit.toLowerCase()),
    ),
  );

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RoutineNameFields>({
    defaultValues: {
      productName: draft.productName,
      form: initialForm,
      amount: initialAmount,
      unit: initialUnit,
    },
    resolver: zodResolver(routineNameSchema),
  });

  const form = useWatch({ control, name: "form" });
  const unit = useWatch({ control, name: "unit" });

  const styles = useMemo(() => createStyles(colors, fontScale), [colors, fontScale]);

  const continueToSchedule = (values: RoutineNameFields) => {
    const amountText = values.amount.trim();
    const parsedAmount = amountText ? positiveAmountSchema.parse(amountText) : null;

    const nextDraft: RoutineDraft = {
      productName: values.productName,
      frequency: draft.frequency,
      time: draft.time,
    };

    if (values.form.trim()) nextDraft.form = values.form.trim();

    if (parsedAmount !== null)
      nextDraft.quantity = { amount: parsedAmount, unit: values.unit.trim() };

    setDraft(nextDraft);
    router.push(`/routine/${id}/schedule`);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: id === "new" ? "New routine" : "Edit routine",
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button tintColor={colors.blue} onPress={() => router.dismiss()}>
          Cancel
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Screen
        footer={
          <>
            {errors.amount?.message ? (
              <Text variant="footnote" textStyle={styles.error}>
                {errors.amount.message}
              </Text>
            ) : errors.productName?.message ? (
              <Text variant="footnote" textStyle={styles.error}>
                {errors.productName.message}
              </Text>
            ) : null}
            <ActionButton
              label="Continue"
              onPress={handleSubmit(continueToSchedule)}
              testID="routine-name-continue"
            />
          </>
        }
      >
        <Column alignment="center" style={styles.hero}>
          <ProductBadge size={96} />
        </Column>
        <Text variant="largeTitle">Which supplement?</Text>
        <Column spacing={8} style={styles.section} modifiers={fillContainerWidth}>
          <Text variant="headline">Supplement name</Text>
          <TextInput
            selectTextOnFocus
            autoCapitalize="sentences"
            autoCorrect={false}
            value={nameInput}
            maxLength={120}
            onChangeText={(value) => {
              nameInput.set(value);
              setValue("productName", value, { shouldDirty: true });
              markDirty();
            }}
            placeholder="e.g. Vitamin D"
            returnKeyType="done"
            style={styles.input}
            textStyle={styles.inputText}
            modifiers={fillAvailableWidth}
            testID="product-name"
          />
          {error ? (
            <Text variant="footnote" color={colors.danger}>
              {error}
            </Text>
          ) : null}
        </Column>
        <Column spacing={8} style={styles.section} modifiers={fillContainerWidth}>
          <Text variant="headline">Product form (optional)</Text>
          <Row
            spacing={12}
            alignment="center"
            style={styles.pickerRow}
            modifiers={fillAvailableWidth}
          >
            <Text variant="body" color={colors.secondary}>
              Form
            </Text>
            <Spacer />
            <Picker
              appearance="menu"
              selectedValue={
                customForm
                  ? customOption
                  : (forms.find((value) => value.toLowerCase() === form.toLowerCase()) ?? "")
              }
              testID="routine-form-picker"
              onValueChange={(value) => {
                if (value !== customOption) {
                  setCustomForm(false);
                  setValue("form", value, { shouldDirty: true });
                  formInput.set(value);
                } else {
                  if (!customForm) {
                    setValue("form", "", { shouldDirty: true });
                    formInput.set("");
                  }

                  setCustomForm(true);
                }

                markDirty();
              }}
            >
              <Picker.Item label="Not specified" value="" />
              {forms.map((value) => (
                <Picker.Item key={value} label={value} value={value} />
              ))}
              <Picker.Item label="Other…" value={customOption} />
            </Picker>
          </Row>
          {customForm ? (
            <TextInput
              autoCapitalize="sentences"
              autoCorrect={false}
              value={formInput}
              onChangeText={(value) => {
                setValue("form", value, { shouldDirty: true });
                formInput.set(value);
                markDirty();
              }}
              placeholder="Other form"
              maxLength={60}
              style={styles.input}
              textStyle={styles.inputText}
              modifiers={fillAvailableWidth}
              testID="routine-form-custom"
            />
          ) : null}
        </Column>
        <Column spacing={8} style={styles.section} modifiers={fillContainerWidth}>
          <Text variant="headline">Planned amount (optional)</Text>
          <TextInput
            value={amountInput}
            onChangeText={(value) => {
              amountInput.set(value);
              setValue("amount", value, { shouldDirty: true });
              markDirty();
            }}
            keyboardType="decimal-pad"
            placeholder="Amount"
            style={styles.input}
            textStyle={styles.inputText}
            modifiers={fillAvailableWidth}
            testID="routine-quantity-amount"
          />
          <Row
            spacing={12}
            alignment="center"
            style={styles.pickerRow}
            modifiers={fillAvailableWidth}
          >
            <Text variant="body" color={colors.secondary}>
              Unit
            </Text>
            <Spacer />
            <Picker
              appearance="menu"
              selectedValue={
                customUnit
                  ? customOption
                  : (units.find((value) => value.toLowerCase() === unit.toLowerCase()) ?? "")
              }
              testID="routine-unit-picker"
              onValueChange={(value) => {
                if (value !== customOption) {
                  setCustomUnit(false);
                  setValue("unit", value, { shouldDirty: true });
                  unitInput.set(value);

                  if (!value) {
                    amountInput.set("");
                    setValue("amount", "", { shouldDirty: true });
                  }
                } else {
                  if (!customUnit) {
                    setValue("unit", "", { shouldDirty: true });
                    unitInput.set("");
                  }

                  setCustomUnit(true);
                }

                markDirty();
              }}
            >
              <Picker.Item label="Not specified" value="" />
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
              onChangeText={(value) => {
                setValue("unit", value, { shouldDirty: true });
                unitInput.set(value);
                markDirty();
              }}
              placeholder="Other unit"
              maxLength={40}
              style={styles.input}
              textStyle={styles.inputText}
              modifiers={fillAvailableWidth}
              testID="routine-quantity-unit-custom"
            />
          ) : null}
        </Column>
      </Screen>
    </>
  );
}

function unitOptions(form: string): string[] {
  const selectedForm = forms.find((value) => value.toLowerCase() === form.toLowerCase());
  const relevant = selectedForm ? relatedUnits[selectedForm] : [];

  return [...relevant, ...units.filter((unit) => !relevant.includes(unit))];
}

function createStyles(colors: ReturnType<typeof usePalette>, fontScale: number) {
  return StyleSheet.create({
    hero: { width: fillParent, paddingTop: 12 },
    section: { width: fillParent },
    input: {
      padding: 16,
      borderRadius: 28,
      backgroundColor: colors.grouped,
    },
    inputText: { color: colors.text, fontSize: 17 * fontScale },
    pickerRow: { padding: 14, borderRadius: 20, backgroundColor: colors.grouped },
    error: { color: colors.danger },
  });
}
