import { useState } from "react";
import { useRoutineStore } from "@/features/routines/RoutinesProvider";
import { pauseRoutine, removeRoutine } from "@/features/routines/routine-actions";

export function useRoutineDetailActions() {
  const { busy, error, pause, remove, reminders, routines } = useRoutineStore();
  const [feedback, setFeedback] = useState<string | null>(null);

  return {
    busy,
    error,
    feedback,
    reminders,
    routines,
    pauseRoutine: (id: string) => pauseRoutine(id, busy, pause, setFeedback),
    removeRoutine: (id: string) => removeRoutine(id, busy, remove, setFeedback),
  };
}
