import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { connectToDeviceRelay } from "@/routines/relay";
import { useRoutines } from "@/routines/useRoutines";

const RoutinesContext = createContext<ReturnType<typeof useRoutines> | null>(null);

export function RoutinesProvider({ children }: { children: ReactNode }) {
  const routines = useRoutines();
  const createRoutineRef = useRef(routines.createRoutineFromRelay);

  useEffect(() => {
    createRoutineRef.current = routines.createRoutineFromRelay;
  }, [routines.createRoutineFromRelay]);

  useEffect(() => {
    if (!routines.ready || !process.env.EXPO_PUBLIC_SERVER_URL) return;

    return connectToDeviceRelay(process.env.EXPO_PUBLIC_SERVER_URL, (request) =>
      createRoutineRef.current(request),
    );
  }, [routines.ready]);

  return <RoutinesContext value={routines}>{children}</RoutinesContext>;
}

export function useRoutineStore() {
  const routines = useContext(RoutinesContext);

  if (!routines) throw new Error("RoutinesProvider is missing.");

  return routines;
}
