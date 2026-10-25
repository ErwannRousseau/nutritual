import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { connectToDeviceRelay } from "@/routines/relay";
import { useRoutines } from "@/routines/useRoutines";
import { phoneRequest, phoneResponses } from "@/auth/phone-api";

const RoutinesContext = createContext<ReturnType<typeof useRoutines> | null>(null);

export function RoutinesProvider({ children }: { children: ReactNode }) {
  const routines = useRoutines();
  const [paired, setPaired] = useState(false);
  const createRoutineRef = useRef(routines.createRoutineFromRelay);

  useEffect(() => {
    createRoutineRef.current = routines.createRoutineFromRelay;
  }, [routines.createRoutineFromRelay]);

  useEffect(() => {
    let active = true;

    const check = () => {
      void phoneRequest("/api/phone/pairing-status", undefined, phoneResponses.paired)
        .then((value) => {
          if (active) setPaired(value.paired);
        })
        .catch(() => {
          if (active) setPaired(false);
        });
    };

    check();
    const timer = setInterval(check, 15_000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!routines.ready || !paired || !process.env.EXPO_PUBLIC_SERVER_URL) return;

    return connectToDeviceRelay(process.env.EXPO_PUBLIC_SERVER_URL, (request) =>
      createRoutineRef.current(request),
    );
  }, [routines.ready, paired]);

  return <RoutinesContext value={routines}>{children}</RoutinesContext>;
}

export function useRoutineStore() {
  const routines = useContext(RoutinesContext);

  if (!routines) throw new Error("RoutinesProvider is missing.");

  return routines;
}
