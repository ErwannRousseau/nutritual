import { useEffect, useState } from "react";
import { BottomSheet, Button, Column, Host, Row, ScrollView, Spacer } from "@expo/ui";
import { AppState, useWindowDimensions } from "react-native";
import type { Intake, ReminderState, Routine, RoutineDraft } from "../routines/model";
import { describeFrequency, isDueOn, localDate } from "../routines/model";
import RoutineForm from "./RoutineForm";
import Text from "./ScaledText";

type Props = {
  routines: Routine[];
  intakes: Intake[];
  reminders: ReminderState[];
  busy: boolean;
  error: string | null;
  onSave: (draft: RoutineDraft, id?: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onPause: (id: string) => Promise<boolean>;
  onRecord: (id: string) => Promise<boolean>;
  onUndo: (id: string) => Promise<boolean>;
  onRetry: () => Promise<void>;
};

type Sheet =
  | { kind: "form"; routine?: Routine }
  | { kind: "manage"; routine: Routine }
  | { kind: "delete"; routine: Routine }
  | { kind: "record"; routine: Routine }
  | { kind: "intake"; intake: Intake }
  | null;

const shortDate = (date: Date) =>
  date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

const timeLabel = (date: Date) =>
  date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export default function RoutineScreen({
  routines,
  intakes,
  reminders,
  busy,
  error,
  onSave,
  onDelete,
  onPause,
  onRecord,
  onUndo,
  onRetry,
}: Props) {
  const { width, fontScale } = useWindowDimensions();
  const stackHeader = width < 380 || fontScale > 1.2;
  const [sheet, setSheet] = useState<Sheet>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [current, setCurrent] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setCurrent(new Date());
    const timer = setInterval(refresh, 60_000);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  const recordedToday = new Set(
    intakes
      .filter((intake) => localDate(new Date(intake.recordedAt)) === localDate(current))
      .map((intake) => intake.routineId),
  );

  const upcoming = routines
    .filter((routine) => isDueOn(routine, current) && !recordedToday.has(routine.id))
    .sort((a, b) => a.time.localeCompare(b.time));

  const asNeeded = routines.filter(
    (routine) => !routine.paused && routine.frequency.kind === "as-needed",
  );

  const paused = routines.filter((routine) => routine.paused);
  const history = [...intakes].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  const dismiss = () => {
    setSheet(null);
    setFeedback(null);
  };

  const openRecord = (routine: Routine) => {
    setFeedback(null);
    setSheet({ kind: "record", routine });
  };

  const save = async (draft: RoutineDraft, id?: string) => {
    try {
      if (!(await onSave(draft, id))) return false;
      setSheet(null);
      setFeedback(id ? "Routine enregistrée." : "Routine créée.");

      return true;
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : "Impossible d’enregistrer la routine.");

      return false;
    }
  };

  const record = async (routine: Routine) => {
    setActionBusy(true);

    try {
      if (!(await onRecord(routine.id))) {
        setFeedback(null);

        return;
      }

      setSheet(null);
      setFeedback("Prise enregistrée.");
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : "La prise n’a pas été enregistrée.");
    } finally {
      setActionBusy(false);
    }
  };

  const heading = (
    <Column spacing={3}>
      <Text textStyle={{ color: "#648087", fontSize: 12, fontWeight: "700", letterSpacing: 1.2 }}>
        NUTRITUAL
      </Text>
      <Text textStyle={{ color: "#14252B", fontSize: 34, fontWeight: "800" }}>Aujourd’hui</Text>
      <Text textStyle={{ color: "#64767C", fontSize: 17 }}>{shortDate(current)}</Text>
    </Column>
  );

  return (
    <Host style={{ flex: 1, backgroundColor: "#FFFFFF" }} colorScheme="light" seedColor="#007AFF">
      <ScrollView style={{ height: "100%" }} showsIndicators>
        <Column spacing={13} style={{ width, padding: 20, backgroundColor: "#FFFFFF" }}>
          {stackHeader ? (
            <Column spacing={8}>
              {heading}
              <Button label="+ Ajouter" onPress={() => setSheet({ kind: "form" })} />
            </Column>
          ) : (
            <Row alignment="center" spacing={10}>
              {heading}
              <Button label="+ Ajouter" onPress={() => setSheet({ kind: "form" })} />
            </Row>
          )}

          {!!error && (
            <Column
              spacing={8}
              style={{ padding: 14, backgroundColor: "#FFF3F2", borderRadius: 16 }}
            >
              <Text textStyle={{ color: "#9F2820", fontSize: 15 }}>{error}</Text>
              <Button
                label="Réessayer"
                variant="outlined"
                disabled={busy}
                onPress={() => void onRetry().catch(() => undefined)}
              />
            </Column>
          )}
          {!!feedback && <Text textStyle={{ color: "#157363", fontSize: 15 }}>{feedback}</Text>}

          <Section title="À venir" count={upcoming.length} />
          {upcoming.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              reminder={reminders.find((item) => item.routineId === routine.id)}
              fontScale={fontScale}
              onRecord={() => openRecord(routine)}
              onManage={() => setSheet({ kind: "manage", routine })}
            />
          ))}
          {upcoming.length === 0 && (
            <Text textStyle={{ color: "#75858A", fontSize: 16 }}>
              Rien de prévu pour aujourd’hui.
            </Text>
          )}

          {asNeeded.length > 0 && <Section title="À la demande" count={asNeeded.length} />}
          {asNeeded.map((routine) => (
            <Column
              key={routine.id}
              spacing={9}
              style={{ padding: 17, backgroundColor: "#EAF8F7", borderRadius: 20 }}
            >
              <Text
                textStyle={{
                  color: "#29847C",
                  fontSize: 11,
                  fontWeight: "800",
                  letterSpacing: 1.1,
                }}
              >
                AU BESOIN
              </Text>
              <Text textStyle={{ color: "#14252B", fontSize: 19, fontWeight: "700" }}>
                {routine.productName}
              </Text>
              <Text textStyle={{ color: "#60747A" }}>{describeFrequency(routine.frequency)}</Text>
              <Column spacing={8}>
                <Button label="Marquer comme pris" onPress={() => openRecord(routine)} />
                <Button
                  label="Gérer"
                  variant="outlined"
                  onPress={() => setSheet({ kind: "manage", routine })}
                />
              </Column>
            </Column>
          ))}

          {paused.length > 0 && <Section title="En pause" count={paused.length} />}
          {paused.map((routine) => (
            <Column
              key={routine.id}
              spacing={7}
              style={{ padding: 17, backgroundColor: "#F2F2F7", borderRadius: 20 }}
            >
              <Text textStyle={{ color: "#14252B", fontSize: 19, fontWeight: "700" }}>
                {routine.productName}
              </Text>
              <Text
                textStyle={{ color: "#60747A" }}
              >{`${describeFrequency(routine.frequency)} · En pause`}</Text>
              <Button
                label="Gérer"
                variant="outlined"
                onPress={() => setSheet({ kind: "manage", routine })}
              />
            </Column>
          ))}

          <Section title="Historique" count={history.length} />
          {history.map((intake) => {
            const date = new Date(intake.recordedAt);

            return (
              <Button
                key={intake.id}
                label={`✓  ${intake.productName} · ${date.toLocaleDateString("fr-FR")} · ${timeLabel(date)}`}
                style={{ padding: 12, backgroundColor: "#F2F2F7", borderRadius: 18 }}
                variant="text"
                onPress={() => setSheet({ kind: "intake", intake })}
              />
            );
          })}
          {history.length === 0 && (
            <Text textStyle={{ color: "#75858A" }}>Les prises enregistrées apparaîtront ici.</Text>
          )}

          <Section title="Toutes les routines" count={routines.length} />
          {routines.map((routine) => (
            <Column
              key={routine.id}
              spacing={5}
              style={{ padding: 12, backgroundColor: "#F7F8FA", borderRadius: 16 }}
            >
              <Text textStyle={{ color: "#14252B", fontWeight: "700" }}>{routine.productName}</Text>
              <Text
                textStyle={{ color: "#687C82" }}
              >{`${routine.frequency.kind === "as-needed" ? "" : `${routine.time} · `}${describeFrequency(routine.frequency)}${routine.paused ? " · En pause" : ""}`}</Text>
              <Text textStyle={{ color: "#687C82", fontSize: 14 }}>
                {reminderText(reminders.find((item) => item.routineId === routine.id))}
              </Text>
              <Column spacing={8}>
                <Button label="Pris" onPress={() => openRecord(routine)} />
                <Button
                  label="Gérer"
                  variant="outlined"
                  onPress={() => setSheet({ kind: "manage", routine })}
                />
              </Column>
            </Column>
          ))}
        </Column>
      </ScrollView>

      <BottomSheet
        isPresented={sheet !== null}
        onDismiss={dismiss}
        snapPoints={sheet?.kind === "record" || sheet?.kind === "intake" ? ["half"] : ["full"]}
        containerColor="#FFFFFF"
        contentPadding={0}
      >
        {sheet?.kind === "form" && (
          <RoutineForm
            key={sheet.routine?.id ?? "new"}
            routine={sheet.routine}
            busy={busy}
            error={error}
            onSave={save}
            onCancel={dismiss}
          />
        )}
        {sheet?.kind === "record" && (
          <RecordSheet
            routine={sheet.routine}
            current={current}
            busy={busy || actionBusy}
            error={feedback || error}
            onRecord={() => void record(sheet.routine)}
            onClose={dismiss}
          />
        )}
        {sheet?.kind === "intake" && (
          <IntakeSheet
            intake={sheet.intake}
            busy={busy}
            error={feedback || error}
            onClose={dismiss}
            onUndo={() =>
              void onUndo(sheet.intake.id)
                .then((ok) => {
                  if (ok) dismiss();
                  else setFeedback(null);
                })
                .catch((cause: unknown) =>
                  setFeedback(
                    cause instanceof Error ? cause.message : "Impossible d’annuler la prise.",
                  ),
                )
            }
          />
        )}
        {sheet?.kind === "manage" && (
          <ManageSheet
            routine={sheet.routine}
            busy={busy}
            error={feedback || error}
            onEdit={() => setSheet({ kind: "form", routine: sheet.routine })}
            onRecord={() => openRecord(sheet.routine)}
            onPause={() =>
              void onPause(sheet.routine.id)
                .then((ok) => {
                  if (ok) dismiss();
                  else setFeedback(null);
                })
                .catch((cause: unknown) =>
                  setFeedback(
                    cause instanceof Error ? cause.message : "Impossible de modifier la routine.",
                  ),
                )
            }
            onDelete={() => setSheet({ kind: "delete", routine: sheet.routine })}
            onClose={dismiss}
          />
        )}
        {sheet?.kind === "delete" && (
          <DeleteSheet
            routine={sheet.routine}
            busy={busy}
            error={feedback || error}
            onCancel={() => setSheet({ kind: "manage", routine: sheet.routine })}
            onDelete={() =>
              void onDelete(sheet.routine.id)
                .then((ok) => {
                  if (ok) {
                    setSheet(null);
                    setFeedback("Routine supprimée.");
                  } else setFeedback(null);
                })
                .catch((cause: unknown) =>
                  setFeedback(
                    cause instanceof Error ? cause.message : "Impossible de supprimer la routine.",
                  ),
                )
            }
          />
        )}
      </BottomSheet>
    </Host>
  );
}

function Section({ title, count }: { title: string; count: number }) {
  return (
    <Row alignment="center" spacing={8}>
      <Text textStyle={{ color: "#182B31", fontSize: 21, fontWeight: "700" }}>{title}</Text>
      <Text textStyle={{ color: "#718187", fontWeight: "700" }}>{String(count)}</Text>
    </Row>
  );
}

function RoutineCard({
  routine,
  reminder,
  fontScale,
  onRecord,
  onManage,
}: {
  routine: Routine;
  reminder?: ReminderState;
  fontScale: number;
  onRecord: () => void;
  onManage: () => void;
}) {
  return (
    <Column
      spacing={8}
      style={{ width: "100%", padding: 17, backgroundColor: "#E3F7FB", borderRadius: 21 }}
    >
      {fontScale > 1.2 ? (
        <Column spacing={6}>
          <Text textStyle={{ color: "#006E82", fontSize: 24, fontWeight: "800" }}>
            {routine.time}
          </Text>
          <Button label="Options" variant="text" onPress={onManage} />
        </Column>
      ) : (
        <Row alignment="center" spacing={10} style={{ width: "100%" }}>
          <Text textStyle={{ color: "#006E82", fontSize: 24, fontWeight: "800" }}>
            {routine.time}
          </Text>
          <Spacer />
          <Button label="Options" variant="text" onPress={onManage} />
        </Row>
      )}
      <Text textStyle={{ color: "#14252B", fontSize: 19, fontWeight: "700" }}>
        {routine.productName}
      </Text>
      <Text textStyle={{ color: "#60747A", fontSize: 15 }}>
        {describeFrequency(routine.frequency)}
      </Text>
      {!!reminder && (
        <Text textStyle={{ color: reminder.status === "scheduled" ? "#547078" : "#885A00" }}>
          {reminderText(reminder)}
        </Text>
      )}
      {fontScale > 1.2 ? (
        <Column spacing={8}>
          <Text textStyle={{ color: "#547078" }}>À prendre aujourd’hui</Text>
          <Button label="Pris" onPress={onRecord} />
        </Column>
      ) : (
        <Row alignment="center" spacing={8} style={{ width: "100%" }}>
          <Text textStyle={{ color: "#547078" }}>À prendre aujourd’hui</Text>
          <Spacer />
          <Button label="Pris" onPress={onRecord} />
        </Row>
      )}
    </Column>
  );
}

function reminderLabel(status: ReminderState["status"]) {
  if (status === "scheduled") return "Rappel programmé.";

  if (status === "denied")
    return "Notifications désactivées. Vous pouvez toujours enregistrer la prise.";

  if (status === "failed") return "Le rappel n’a pas pu être programmé.";

  if (status === "paused") return "Rappels en pause.";

  return "Aucun rappel programmé.";
}

function reminderText(reminder?: ReminderState) {
  return reminder
    ? reminder.message || reminderLabel(reminder.status)
    : "État du rappel indisponible.";
}

function RecordSheet({
  routine,
  current,
  busy,
  error,
  onRecord,
  onClose,
}: {
  routine: Routine;
  current: Date;
  busy: boolean;
  error: string | null;
  onRecord: () => void;
  onClose: () => void;
}) {
  return (
    <ScrollView style={{ height: "100%" }}>
      <Column spacing={12} style={{ padding: 22, backgroundColor: "#FFFFFF" }}>
        <Text textStyle={{ color: "#648087", fontSize: 12, fontWeight: "800", letterSpacing: 1.2 }}>
          ENREGISTRER UNE PRISE
        </Text>
        <Text textStyle={{ color: "#007F95", fontSize: 40, fontWeight: "800" }}>○</Text>
        <Text textStyle={{ color: "#14252B", fontSize: 43, fontWeight: "800" }}>
          {routine.frequency.kind === "as-needed" ? "À la demande" : routine.time}
        </Text>
        <Text textStyle={{ color: "#62747A", fontSize: 16 }}>{shortDate(current)}</Text>
        <Column spacing={6} style={{ padding: 17, backgroundColor: "#E3F7FB", borderRadius: 19 }}>
          <Text textStyle={{ color: "#007F95", fontSize: 12, fontWeight: "800", letterSpacing: 1 }}>
            À PRENDRE
          </Text>
          <Text textStyle={{ color: "#14252B", fontSize: 21, fontWeight: "700" }}>
            {routine.productName}
          </Text>
        </Column>
        {!!error && <Text textStyle={{ color: "#A12A23" }}>{error}</Text>}
        <Button label={busy ? "Enregistrement…" : "Pris"} disabled={busy} onPress={onRecord} />
        <Button label="Fermer" variant="outlined" onPress={onClose} />
      </Column>
    </ScrollView>
  );
}

function IntakeSheet({
  intake,
  busy,
  error,
  onClose,
  onUndo,
}: {
  intake: Intake;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onUndo: () => void;
}) {
  const date = new Date(intake.recordedAt);

  return (
    <ScrollView style={{ height: "100%" }}>
      <Column spacing={11} style={{ padding: 22, backgroundColor: "#FFFFFF" }}>
        <Text textStyle={{ color: "#648087", fontSize: 12, fontWeight: "800", letterSpacing: 1.2 }}>
          PRISE ENREGISTRÉE
        </Text>
        <Text textStyle={{ color: "#007F95", fontSize: 40, fontWeight: "800" }}>✓</Text>
        <Text textStyle={{ color: "#14252B", fontSize: 43, fontWeight: "800" }}>
          {timeLabel(date)}
        </Text>
        <Text textStyle={{ color: "#62747A", fontSize: 16 }}>{shortDate(date)}</Text>
        <Column spacing={6} style={{ padding: 17, backgroundColor: "#E3F7FB", borderRadius: 19 }}>
          <Text textStyle={{ color: "#007F95", fontSize: 12, fontWeight: "800", letterSpacing: 1 }}>
            PRIS
          </Text>
          <Text textStyle={{ color: "#14252B", fontSize: 21, fontWeight: "700" }}>
            {intake.productName}
          </Text>
        </Column>
        {!!error && <Text textStyle={{ color: "#A12A23" }}>{error}</Text>}
        <Button label="Annuler la prise" variant="outlined" disabled={busy} onPress={onUndo} />
        <Button label="Fermer" variant="text" onPress={onClose} />
      </Column>
    </ScrollView>
  );
}

function ManageSheet({
  routine,
  busy,
  error,
  onEdit,
  onRecord,
  onPause,
  onDelete,
  onClose,
}: {
  routine: Routine;
  busy: boolean;
  error: string | null;
  onEdit: () => void;
  onRecord: () => void;
  onPause: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <ScrollView style={{ height: "100%" }}>
      <Column spacing={10} style={{ padding: 22, backgroundColor: "#FFFFFF" }}>
        <Text textStyle={{ color: "#648087", fontSize: 12, fontWeight: "800", letterSpacing: 1.2 }}>
          ROUTINE
        </Text>
        <Text textStyle={{ color: "#14252B", fontSize: 25, fontWeight: "800" }}>
          {routine.productName}
        </Text>
        <Text
          textStyle={{ color: "#62747A" }}
        >{`${routine.frequency.kind === "as-needed" ? "" : `${routine.time} · `}${describeFrequency(routine.frequency)}`}</Text>
        {!!error && <Text textStyle={{ color: "#A12A23" }}>{error}</Text>}
        <Button label="Modifier" onPress={onEdit} />
        <Button label="Enregistrer une prise" onPress={onRecord} />
        <Button
          label={routine.paused ? "Reprendre" : "Mettre en pause"}
          variant="outlined"
          disabled={busy}
          onPress={onPause}
        />
        <Button label="Supprimer" variant="outlined" disabled={busy} onPress={onDelete} />
        <Button label="Fermer" variant="text" onPress={onClose} />
      </Column>
    </ScrollView>
  );
}

function DeleteSheet({
  routine,
  busy,
  error,
  onCancel,
  onDelete,
}: {
  routine: Routine;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <ScrollView style={{ height: "100%" }}>
      <Column spacing={12} style={{ padding: 22, backgroundColor: "#FFFFFF" }}>
        <Text textStyle={{ color: "#A12A23", fontSize: 12, fontWeight: "800", letterSpacing: 1.2 }}>
          SUPPRESSION
        </Text>
        <Text textStyle={{ color: "#14252B", fontSize: 25, fontWeight: "800" }}>
          Supprimer cette routine ?
        </Text>
        <Text
          textStyle={{ color: "#62747A" }}
        >{`${routine.productName} ne figurera plus dans votre planning.`}</Text>
        {!!error && <Text textStyle={{ color: "#A12A23" }}>{error}</Text>}
        <Button label="Supprimer" variant="outlined" disabled={busy} onPress={onDelete} />
        <Button label="Garder la routine" onPress={onCancel} />
      </Column>
    </ScrollView>
  );
}
