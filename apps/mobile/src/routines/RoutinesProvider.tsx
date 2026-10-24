import { createContext, useContext, type ReactNode } from "react";
import { useRoutines } from "./useRoutines";

const RoutinesContext = createContext<ReturnType<typeof useRoutines> | null>(null);

export function RoutinesProvider({ children }: { children: ReactNode }) {
  const routines = useRoutines();

  return <RoutinesContext value={routines}>{children}</RoutinesContext>;
}

export function useRoutineStore() {
  const routines = useContext(RoutinesContext);

  if (!routines) throw new Error("RoutinesProvider is missing.");

  return routines;
}
