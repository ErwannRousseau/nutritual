import { randomUUID } from "expo-crypto";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type { Intake, ReminderState, Routine, RoutineDraft } from "./model";
import { validateRoutine } from "./model";
import * as storage from "./storage";
import { removeOrphanReminders, removeReminders, updateReminder } from "./reminders";

export function useRoutines() {
  const [data, setData] = useState<{ routines: Routine[]; intakes: Intake[] }>({
    routines: [],
    intakes: [],
  });

  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reminders, setReminders] = useState<ReminderState[]>([]);
  const locked = useRef(true);

  async function run(action: () => Promise<void>): Promise<boolean> {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError(null);

    try {
      await action();
      setData(await storage.loadData());

      return true;
    } catch {
      setError("Impossible de lire ou d’enregistrer les données sur ce téléphone. Réessayez.");

      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  async function reload(): Promise<void> {
    await run(async () => {
      const stored = await storage.loadData();
      setReminders(await restoreReminders(stored.routines));
    });
  }

  useEffect(() => {
    let active = true;
    storage
      .loadData()
      .then(async (stored) => {
        if (!active) return;

        setData(stored);
        const restored = await restoreReminders(stored.routines);

        if (active) setReminders(restored);
      })
      .catch(() => {
        if (active) setError("Impossible de lire les données sur ce téléphone. Réessayez.");
      })
      .finally(() => {
        if (active) {
          locked.current = false;
          setBusy(false);
        }
      });

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void reload();
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  async function save(draft: RoutineDraft, id?: string): Promise<boolean> {
    const validation = validateRoutine(draft);

    if (validation) {
      setError(validation);

      return false;
    }

    const existing = id ? data.routines.find((routine) => routine.id === id) : undefined;

    if (id && !existing) return false;

    const routine: Routine = {
      ...draft,
      productName: draft.productName.trim(),
      id: existing?.id ?? randomUUID(),
      paused: existing?.paused ?? false,
    };

    return run(async () => {
      await storage.saveRoutine(routine);
      const result = await updateReminder(routine, true);
      setReminders((current) => [
        ...current.filter((item) => item.routineId !== routine.id),
        result,
      ]);
    });
  }

  async function remove(id: string): Promise<boolean> {
    return run(async () => {
      await removeReminders(id);
      await storage.deleteRoutine(id);
      setReminders((current) => current.filter((item) => item.routineId !== id));
    });
  }

  async function pause(id: string): Promise<boolean> {
    const routine = data.routines.find((item) => item.id === id);

    if (!routine) return false;

    const updated = { ...routine, paused: !routine.paused };

    return run(async () => {
      await storage.saveRoutine(updated);
      const result = await updateReminder(updated, !updated.paused);
      setReminders((current) => [...current.filter((item) => item.routineId !== id), result]);
    });
  }

  async function record(id: string): Promise<boolean> {
    const routine = data.routines.find((item) => item.id === id);

    if (!routine) return false;

    return run(() =>
      storage.saveIntake({
        id: randomUUID(),
        routineId: routine.id,
        productName: routine.productName,
        recordedAt: new Date().toISOString(),
      }),
    );
  }

  async function undo(id: string): Promise<boolean> {
    return run(() => storage.deleteIntake(id));
  }

  return { ...data, reminders, busy, error, save, remove, pause, record, undo, reload };
}

async function restoreReminders(routines: Routine[]): Promise<ReminderState[]> {
  await removeOrphanReminders(routines.map((routine) => routine.id));
  const results: ReminderState[] = [];

  for (const routine of routines) results.push(await updateReminder(routine, false));

  return results;
}
