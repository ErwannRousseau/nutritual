import { randomUUID } from "expo-crypto";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import type { Intake, ReminderState, Routine, RoutineDraft } from "@/features/routines/model";
import { validateRoutine } from "@/features/routines/model";
import * as storage from "@/features/routines/storage";
import { removeReminders, restoreReminders, updateReminder } from "@/features/routines/reminders";
import { createRoutineFromRelayHandler } from "@/features/routines/create-routine-from-relay";

export function useRoutines() {
  const [data, setData] = useState<{ routines: Routine[]; intakes: Intake[] }>({
    routines: [],
    intakes: [],
  });

  const [busy, setBusy] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminders, setReminders] = useState<ReminderState[]>([]);
  const locked = useRef(true);

  const createRoutineFromRelay = useMemo(
    () =>
      createRoutineFromRelayHandler({
        onData: setData,
        onError: setError,
        onReminder: (reminder) =>
          setReminders((current) => [
            ...current.filter((item) => item.routineId !== reminder.routineId),
            reminder,
          ]),
      }),
    [setData, setError, setReminders],
  );

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
      setError("Unable to read or save data on this phone. Try again.");

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
        if (active) setError("Unable to read data on this phone. Try again.");
      })
      .finally(() => {
        if (active) {
          locked.current = false;
          setBusy(false);
          setReady(true);
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

  return {
    ...data,
    reminders,
    busy,
    ready,
    error,
    save,
    createRoutineFromRelay,
    remove,
    pause,
    record,
    undo,
    reload,
  };
}
