import { randomUUID } from "expo-crypto";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  reminderOutcomes,
  createRoutineStatus,
  validateRoutineInput,
  type CreateRoutineRequest,
  type CreateRoutineResult,
  type ReminderOutcome,
} from "@nutritual/protocol";
import type { Intake, ReminderState, Routine, RoutineDraft } from "@/routines/model";
import { validateRoutine } from "@/routines/model";
import * as storage from "@/routines/storage";
import { removeOrphanReminders, removeReminders, updateReminder } from "@/routines/reminders";

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

  const relayOperations = useRef(
    new Map<string, { requestJson: string; promise: Promise<CreateRoutineResult> }>(),
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

  async function createRoutineFromRelayOnce(
    request: CreateRoutineRequest,
  ): Promise<CreateRoutineResult> {
    const validation = validateRoutineInput(request);

    if (validation) {
      return {
        status: createRoutineStatus.invalid,
        operationId: request.operationId,
        message: validation,
      };
    }

    const routine: Routine = {
      id: randomUUID(),
      productName: request.productName.trim(),
      frequency: request.frequency,
      time: request.time,
      paused: false,
    };

    try {
      const operation = await storage.createRoutineOperation(request, routine);

      if (operation.status === createRoutineStatus.conflict) {
        return {
          status: createRoutineStatus.conflict,
          operationId: request.operationId,
          message: "Cet identifiant a déjà été utilisé avec une autre routine.",
        };
      }

      if (operation.status === createRoutineStatus.alreadyProcessed) {
        return {
          status: createRoutineStatus.alreadyProcessed,
          operationId: request.operationId,
          routineId: operation.routineId,
          reminder: operation.reminder,
        };
      }

      const reminderState = await updateReminder(operation.routine, true);

      let reminder: ReminderOutcome =
        reminderState.status === "paused" ? reminderOutcomes.failed : reminderState.status;

      try {
        await storage.updateRoutineOperationReminder(request.operationId, reminder);
      } catch {
        reminder = reminderOutcomes.unconfirmed;
      }

      setReminders((current) => [
        ...current.filter((item) => item.routineId !== operation.routine.id),
        reminderState,
      ]);

      try {
        setData(await storage.loadData());
      } catch {
        setError("Impossible de lire les données sur ce téléphone. Réessayez.");
      }

      return {
        status: createRoutineStatus.created,
        operationId: request.operationId,
        routineId: operation.routine.id,
        reminder,
      };
    } catch {
      return {
        status: createRoutineStatus.failed,
        operationId: request.operationId,
        message: "Impossible d’enregistrer la routine sur ce téléphone.",
      };
    }
  }

  function createRoutineFromRelay(request: CreateRoutineRequest): Promise<CreateRoutineResult> {
    const requestJson = storage.createRoutineRequestJson(request);
    const existing = relayOperations.current.get(request.operationId);

    if (existing) {
      if (existing.requestJson !== requestJson) {
        return Promise.resolve({
          status: createRoutineStatus.conflict,
          operationId: request.operationId,
          message: "Cet identifiant a déjà été utilisé avec une autre routine.",
        });
      }

      return existing.promise.then((result) =>
        result.status === createRoutineStatus.created
          ? { ...result, status: createRoutineStatus.alreadyProcessed }
          : result,
      );
    }

    const promise = createRoutineFromRelayOnce(request).finally(() => {
      if (relayOperations.current.get(request.operationId)?.promise === promise) {
        relayOperations.current.delete(request.operationId);
      }
    });

    relayOperations.current.set(request.operationId, { requestJson, promise });

    return promise;
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

async function restoreReminders(routines: Routine[]): Promise<ReminderState[]> {
  await removeOrphanReminders(routines.map((routine) => routine.id));
  const results: ReminderState[] = [];

  for (const routine of routines) results.push(await updateReminder(routine, false));

  return results;
}
