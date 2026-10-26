import { useState } from "react";
import type { RoutineDraft } from "@/features/routines/model";
import { useRoutineStore } from "@/features/routines/RoutinesProvider";
import { saveRoutineDraft } from "@/features/routines/routine-actions";

export function useSaveRoutine(id: string, draft: RoutineDraft | null, finish: () => void) {
  const { busy, error, reload, save } = useRoutineStore();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  return {
    busy,
    storeError: error,
    reload,
    saving,
    saveError,
    saveRoutine: () =>
      saveRoutineDraft(
        draft,
        id === "new" ? undefined : id,
        busy,
        error,
        save,
        finish,
        setSaving,
        setSaveError,
      ),
  };
}
