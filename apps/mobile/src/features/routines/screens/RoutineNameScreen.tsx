import { useEffect, useMemo, useRef, useState } from "react";
import { Column, useNativeState } from "@expo/ui";
import { TextInput } from "@expo/ui";
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
import ChoiceRow from "@/features/routines/components/ChoiceRow";
import { parsePositiveAmount } from "@/features/routines/routine-quantity-input";
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

export default function RoutineNameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { draft, setDraft, ready, missing, markDirty } = useRoutineDraft();
  const { error, reload } = useRoutineStore();
  const colors = usePalette();
  const { fontScale } = useWindowDimensions();
  const editedName = useRef<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [form, setForm] = useState("");
  const [customForm, setCustomForm] = useState(false);
  const formInput = useNativeState("");
  const amountInput = useNativeState("");
  const [unit, setUnit] = useState("");
  const [customUnit, setCustomUnit] = useState(false);
  const unitInput = useNativeState("");

  useEffect(() => {
    if (!draft) return;
    setForm(draft.form ?? "");
    formInput.set(draft.form ?? "");
    setCustomForm(
      Boolean(
        draft.form && !forms.some((value) => value.toLowerCase() === draft.form?.toLowerCase()),
      ),
    );
    amountInput.set(draft.quantity ? String(draft.quantity.amount) : "");
    setUnit(draft.quantity?.unit ?? "");
    unitInput.set(draft.quantity?.unit ?? "");
    setCustomUnit(
      Boolean(
        draft.quantity?.unit &&
        !units.some((value) => value.toLowerCase() === draft.quantity?.unit.toLowerCase()),
      ),
    );
  }, [amountInput, draft, formInput, ready, unitInput]);

  const styles = useMemo(() => createStyles(colors, fontScale), [colors, fontScale]);

  const continueToSchedule = () => {
    if (!draft) return;
    const amountText = amountInput.value.trim();
    const unitText = unit.trim();
    const parsedAmount = amountText ? parsePositiveAmount(amountText) : null;

    if (Boolean(amountText) !== Boolean(unitText) || (amountText && parsedAmount === null)) {
      setValidationError("Enter a positive amount and its unit, or clear both.");

      return;
    }

    const nextDraft: RoutineDraft = {
      productName: editedName.current ?? draft.productName,
      frequency: draft.frequency,
      time: draft.time,
    };

    if (form.trim()) nextDraft.form = form.trim();

    if (parsedAmount !== null) nextDraft.quantity = { amount: parsedAmount, unit: unitText };

    const errorMessage = nextDraft.productName.trim() ? null : "Supplement name is required.";

    if (errorMessage) {
      setValidationError(errorMessage);

      return;
    }

    setDraft(nextDraft);
    router.push(`/routine/${id}/schedule`);
  };

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
            {validationError ? (
              <Text variant="footnote" textStyle={styles.error}>
                {validationError}
              </Text>
            ) : null}
            <ActionButton
              label="Continue"
              onPress={continueToSchedule}
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
            defaultValue={draft.productName}
            maxLength={120}
            onChangeText={(value) => {
              editedName.current = value;
              markDirty();
              setValidationError(null);
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
          <ChoiceRow
            label="Not specified"
            selected={!form}
            onPress={() => {
              setForm("");
              formInput.set("");
              setCustomForm(false);
              markDirty();
              setValidationError(null);
            }}
          />
          {forms.map((value) => (
            <ChoiceRow
              key={value}
              label={value}
              selected={!customForm && form.toLowerCase() === value.toLowerCase()}
              onPress={() => {
                setForm(value);
                formInput.set(value);
                setCustomForm(false);
                markDirty();
                setValidationError(null);
              }}
            />
          ))}
          <TextInput
            autoCapitalize="sentences"
            autoCorrect={false}
            value={formInput}
            onChangeText={(value) => {
              setForm(value);
              formInput.set(value);
              setCustomForm(true);
              markDirty();
              setValidationError(null);
            }}
            placeholder="Other form"
            maxLength={60}
            style={styles.input}
            textStyle={styles.inputText}
            modifiers={fillAvailableWidth}
            testID="routine-form-custom"
          />
        </Column>
        <Column spacing={8} style={styles.section} modifiers={fillContainerWidth}>
          <Text variant="headline">Planned amount (optional)</Text>
          <TextInput
            value={amountInput}
            onChangeText={(value) => {
              amountInput.set(value);
              markDirty();
              setValidationError(null);
            }}
            keyboardType="decimal-pad"
            placeholder="Amount"
            maxLength={16}
            style={styles.input}
            textStyle={styles.inputText}
            modifiers={fillAvailableWidth}
            testID="routine-quantity-amount"
          />
          <ChoiceRow
            label="Not specified"
            selected={!unit}
            onPress={() => {
              setUnit("");
              amountInput.set("");
              setCustomUnit(false);
              unitInput.set("");
              markDirty();
              setValidationError(null);
            }}
          />
          {unitOptions(form).map((value) => (
            <ChoiceRow
              key={value}
              label={value}
              selected={!customUnit && unit.toLowerCase() === value.toLowerCase()}
              onPress={() => {
                setUnit(value);
                unitInput.set(value);
                setCustomUnit(false);
                markDirty();
                setValidationError(null);
              }}
            />
          ))}
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            value={unitInput}
            onChangeText={(value) => {
              setUnit(value);
              unitInput.set(value);
              setCustomUnit(true);
              markDirty();
              setValidationError(null);
            }}
            placeholder="Other unit"
            maxLength={40}
            style={styles.input}
            textStyle={styles.inputText}
            modifiers={fillAvailableWidth}
            testID="routine-quantity-unit-custom"
          />
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
    error: { color: colors.danger },
  });
}
