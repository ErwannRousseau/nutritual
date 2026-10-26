import { useEffect, useState } from "react";
import { AppState } from "react-native";
import type { Intake, Routine } from "@/features/routines/model";
import { selectDailyOverview } from "./daily-overview";

export function useDailyOverview(routines: Routine[], intakes: Intake[]) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = setInterval(refresh, 60_000);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  return { now, ...selectDailyOverview(routines, intakes, now) };
}
