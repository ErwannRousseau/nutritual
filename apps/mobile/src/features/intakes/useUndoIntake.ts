import { useState } from "react";
import { useRoutineStore } from "@/features/routines/RoutinesProvider";
import { undoIntakeAction } from "@/features/intakes/intake-actions";

export function useUndoIntake() {
  const { busy, error, intakes, undo } = useRoutineStore();
  const [isUndoing, setIsUndoing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const isActionDisabled = busy || isUndoing;

  return {
    busy,
    error,
    intakes,
    isUndoing,
    isActionDisabled,
    feedback,
    undoIntake: (id: string) =>
      undoIntakeAction(id, isActionDisabled, undo, setIsUndoing, setFeedback),
  };
}
