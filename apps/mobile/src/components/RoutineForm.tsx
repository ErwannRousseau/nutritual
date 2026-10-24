import { useState } from "react";
import { Button, Column, ScrollView, TextInput } from "@expo/ui";
import { useWindowDimensions } from "react-native";
import type { Frequency, Routine, RoutineDraft } from "../routines/model";
import { describeFrequency, localDate, validateRoutine } from "../routines/model";
import Text from "./ScaledText";

const week = [
  ["Dim.", "Dimanche"],
  ["Lun.", "Lundi"],
  ["Mar.", "Mardi"],
  ["Mer.", "Mercredi"],
  ["Jeu.", "Jeudi"],
  ["Ven.", "Vendredi"],
  ["Sam.", "Samedi"],
] as const;

type Props = {
  routine?: Routine;
  busy: boolean;
  error: string | null;
  onSave: (draft: RoutineDraft, id?: string) => Promise<boolean>;
  onCancel: () => void;
};

export default function RoutineForm({ routine, busy, error, onSave, onCancel }: Props) {
  const { fontScale } = useWindowDimensions();
  const [productName, setProductName] = useState(routine?.productName ?? "");

  const [frequency, setFrequency] = useState<Frequency>(
    routine?.frequency ?? { kind: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] },
  );

  const [time, setTime] = useState(routine?.time ?? "08:00");

  const [every, setEvery] = useState(
    routine?.frequency.kind === "interval" ? String(routine.frequency.every) : "2",
  );

  const [startDate, setStartDate] = useState(() =>
    routine?.frequency.kind === "interval" ? routine.frequency.startDate : localDate(new Date()),
  );

  const [formError, setFormError] = useState<string | null>(null);
  const selectedDays = frequency.kind === "weekdays" ? frequency.days : [];

  const setInterval = (nextEvery = Number(every), nextDate = startDate) =>
    setFrequency({ kind: "interval", every: nextEvery, startDate: nextDate });

  return (
    <ScrollView style={{ height: "100%" }} showsIndicators>
      <Column spacing={14} style={{ padding: 20, backgroundColor: "#FFFFFF" }}>
        <Column spacing={4}>
          <Text textStyle={{ color: "#14252B", fontSize: 25, fontWeight: "700" }}>
            {routine ? "Modifier la routine" : "Nouvelle routine"}
          </Text>
          <Button label="Fermer" variant="text" onPress={onCancel} />
        </Column>

        <Text textStyle={{ color: "#40535A", fontWeight: "600" }}>Produit ou complément</Text>
        <TextInput
          testID="product-name"
          selectTextOnFocus
          defaultValue={productName}
          onChangeText={setProductName}
          placeholder="Ex. Vitamine D"
          maxLength={120}
          returnKeyType="done"
          style={{ backgroundColor: "#F4F7F8", padding: 14, borderRadius: 14 }}
          textStyle={{ color: "#14252B", fontSize: 17 * fontScale }}
        />

        <Text textStyle={{ color: "#40535A", fontWeight: "600" }}>Fréquence</Text>
        <Column spacing={7}>
          <Button
            label="Chaque jour"
            variant={
              frequency.kind === "weekdays" && selectedDays.length === 7 ? "filled" : "outlined"
            }
            onPress={() => setFrequency({ kind: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] })}
          />
          <Button
            label="Certains jours"
            variant={
              frequency.kind === "weekdays" && selectedDays.length !== 7 ? "filled" : "outlined"
            }
            onPress={() =>
              setFrequency({
                kind: "weekdays",
                days:
                  selectedDays.length && selectedDays.length < 7 ? selectedDays : [1, 2, 3, 4, 5],
              })
            }
          />
          {frequency.kind === "weekdays" && selectedDays.length !== 7 && (
            <Column spacing={4}>
              {week.map(([, name], day) => (
                <Button
                  key={day}
                  label={`${name}${selectedDays.includes(day) ? " · sélectionné" : ""}`}
                  variant={selectedDays.includes(day) ? "filled" : "outlined"}
                  onPress={() =>
                    setFrequency({
                      kind: "weekdays",
                      days: selectedDays.includes(day)
                        ? selectedDays.filter((item) => item !== day)
                        : [...selectedDays, day].sort(),
                    })
                  }
                  testID={`weekday-${name.toLowerCase()}`}
                />
              ))}
            </Column>
          )}
          <Button
            label="Tous les N jours"
            variant={frequency.kind === "interval" ? "filled" : "outlined"}
            onPress={() => setInterval()}
          />
          <Button
            label="À la demande"
            variant={frequency.kind === "as-needed" ? "filled" : "outlined"}
            onPress={() => setFrequency({ kind: "as-needed" })}
          />
        </Column>

        {frequency.kind === "interval" && (
          <Column spacing={8}>
            <Text textStyle={{ color: "#40535A", fontWeight: "600" }}>
              Nombre de jours entre les prises
            </Text>
            <TextInput
              testID="interval-days"
              selectTextOnFocus
              defaultValue={every}
              onChangeText={(value) => {
                setEvery(value);
                setInterval(Number(value));
              }}
              placeholder="2"
              keyboardType="number-pad"
              style={{ backgroundColor: "#F4F7F8", padding: 14, borderRadius: 14 }}
              textStyle={{ color: "#14252B", fontSize: 17 * fontScale }}
            />
            <Text textStyle={{ color: "#40535A", fontWeight: "600" }}>
              Date de départ (YYYY-MM-DD)
            </Text>
            <TextInput
              testID="start-date"
              selectTextOnFocus
              defaultValue={startDate}
              onChangeText={(value) => {
                setStartDate(value);
                setInterval(Number(every), value);
              }}
              placeholder="2026-10-24"
              autoCapitalize="none"
              style={{ backgroundColor: "#F4F7F8", padding: 14, borderRadius: 14 }}
              textStyle={{ color: "#14252B", fontSize: 17 * fontScale }}
            />
          </Column>
        )}

        {frequency.kind !== "as-needed" && (
          <Column spacing={8}>
            <Text textStyle={{ color: "#40535A", fontWeight: "600" }}>Heure (HH:mm)</Text>
            <TextInput
              testID="routine-time"
              defaultValue={time}
              selectTextOnFocus
              onChangeText={setTime}
              placeholder="08:00"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              style={{ backgroundColor: "#F4F7F8", padding: 14, borderRadius: 14 }}
              textStyle={{ color: "#14252B", fontSize: 20 * fontScale, fontWeight: "700" }}
            />
          </Column>
        )}
        <Text textStyle={{ color: "#687C82" }}>{describeFrequency(frequency)}</Text>
        {!!(formError || error) && (
          <Text textStyle={{ color: "#A12A23" }}>{formError ?? error ?? ""}</Text>
        )}

        <Column spacing={9}>
          <Button label="Annuler" variant="outlined" disabled={busy} onPress={onCancel} />
          <Button
            label={busy ? "Enregistrement…" : routine ? "Enregistrer" : "Créer la routine"}
            disabled={busy}
            onPress={() => {
              const draft = { productName, frequency, time };
              const validation = validateRoutine(draft);
              setFormError(validation);

              if (!validation) void onSave(draft, routine?.id);
            }}
          />
        </Column>
      </Column>
    </ScrollView>
  );
}
