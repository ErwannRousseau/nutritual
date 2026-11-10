import { randomUUID } from "expo-crypto";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import type { Intake, ReminderState, Routine, RoutineDraft } from "@/features/routines/model";
import { validateRoutine } from "@/features/routines/model";
import * as storage from "@/features/routines/storage";
import { removeReminders, restoreReminders, updateReminder } from "@/features/routines/reminders";
import { createRoutineFromRelayHandler } from "@/features/routines/create-routine-from-relay";
import { editRoutineFromRelayHandler } from "@/features/routines/edit-routine-from-relay";
import { deleteRoutineFromRelayHandler } from "@/features/routines/delete-routine-from-relay";
import { createActionQueue } from "@/features/routines/action-queue";

export function useRoutines() {
  const [data, setData] = useState<{ routines: Routine[]; intakes: Intake[] }>({
    routines: [],
    intakes: [],
  });

  const [busy, setBusy] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminders, setReminders] = useState<ReminderState[]>([]);
  const [actionQueue] = useState(() => createActionQueue(setBusy));

  const createRoutineFromRelay = useMemo(
    () =>
      createRoutineFromRelayHandler({
        onData: setData,
        onError: setError,
        serialize: actionQueue.run,
        onReminder: (reminder) =>
          setReminders((current) => [
            ...current.filter((item) => item.routineId !== reminder.routineId),
            reminder,
          ]),
      }),
    [actionQueue],
  );

  const editRoutineFromRelay = useMemo(
    () =>
      editRoutineFromRelayHandler({
        onData: setData,
        onError: setError,
        serialize: actionQueue.run,
        onReminder: (reminder) =>
          setReminders((current) => [
            ...current.filter((item) => item.routineId !== reminder.routineId),
            reminder,
          ]),
      }),
    [actionQueue],
  );

  const deleteRoutineFromRelay = useMemo(
    () =>
      deleteRoutineFromRelayHandler({
        onData: setData,
        onError: setError,
        onDeleted: (routineId) =>
          setReminders((current) => current.filter((item) => item.routineId !== routineId)),
        serialize: actionQueue.run,
      }),
    [actionQueue],
  );

  const run = useCallback(
    async (action: () => Promise<void>): Promise<boolean> => {
      if (actionQueue.isBusy()) return false;

      return actionQueue.run(async () => {
        setError(null);

        try {
          await action();
          setData(await storage.loadData());

          return true;
        } catch {
          setError("Unable to read or save data on this phone. Try again.");

          return false;
        }
      });
    },
    [actionQueue],
  );

  const reload = useCallback(async (): Promise<void> => {
    await run(async () => {
      const stored = await storage.loadData();
      setReminders(await restoreReminders(stored.routines));
    });
  }, [run]);

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
          actionQueue.finishLoading();
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
  }, [actionQueue, reload]);

  async function save(draft: RoutineDraft, id?: string): Promise<boolean> {
    const validation = validateRoutine(draft);

    if (validation) {
      setError(validation);

      return false;
    }

    let missing = false;

    const saved = await run(async () => {
      const existing = id
        ? (await storage.loadData()).routines.find((routine) => routine.id === id)
        : undefined;

      if (id && !existing) {
        missing = true;

        return;
      }

      const routine: Routine = {
        ...draft,
        productName: draft.productName.trim(),
        id: existing?.id ?? randomUUID(),
        paused: existing?.paused ?? false,
      };

      await storage.saveRoutine(routine);
      const result = await updateReminder(routine, true);
      setReminders((current) => [
        ...current.filter((item) => item.routineId !== routine.id),
        result,
      ]);
    });

    return saved && !missing;
  }

  async function remove(id: string): Promise<boolean> {
    return run(async () => {
      await removeReminders(id);
      await storage.deleteRoutine(id);
      setReminders((current) => current.filter((item) => item.routineId !== id));
    });
  }

  async function pause(id: string): Promise<boolean> {
    let missing = false;

    const updated = await run(async () => {
      const routine = (await storage.loadData()).routines.find((item) => item.id === id);

      if (!routine) {
        missing = true;

        return;
      }

      const next = { ...routine, paused: !routine.paused };
      await storage.saveRoutine(next);
      const result = await updateReminder(next, !next.paused);
      setReminders((current) => [...current.filter((item) => item.routineId !== id), result]);
    });

    return updated && !missing;
  }

  async function record(id: string): Promise<boolean> {
    let missing = false;

    const recorded = await run(async () => {
      const routine = (await storage.loadData()).routines.find((item) => item.id === id);

      if (!routine) {
        missing = true;

        return;
      }

      await storage.saveIntake({
        id: randomUUID(),
        routineId: routine.id,
        productName: routine.productName,
        recordedAt: new Date().toISOString(),
      });
    });

    return recorded && !missing;
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
    editRoutineFromRelay,
    deleteRoutineFromRelay,
    remove,
    pause,
    record,
    undo,
    reload,
  };
}
