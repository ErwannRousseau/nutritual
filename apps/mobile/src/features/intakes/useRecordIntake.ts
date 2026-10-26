import { useState } from "react";
import { useRoutineStore } from "@/features/routines/RoutinesProvider";
import { recordIntakeAction } from "@/features/intakes/intake-actions";

export function useRecordIntake() {
  const { busy, error, record, routines } = useRoutineStore();
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const isActionDisabled = busy || isSaving;

  return {
    busy,
    error,
    feedback,
    isSaving,
    isActionDisabled,
    routines,
    recordIntake: (id: string, selected: boolean) =>
      recordIntakeAction(id, selected, isActionDisabled, record, setIsSaving, setFeedback),
  };
}
