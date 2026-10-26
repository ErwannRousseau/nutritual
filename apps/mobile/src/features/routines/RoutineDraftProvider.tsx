import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { router, useLocalSearchParams, usePreventRemove } from "expo-router";
import { Alert } from "react-native";
import type { RoutineDraft } from "@/features/routines/model";
import { useRoutineStore } from "@/features/routines/RoutinesProvider";
import { FrequencyKind } from "@nutritual/protocol";

type RoutineDraftValue = {
  draft: RoutineDraft | null;
  setDraft: (draft: RoutineDraft) => void;
  ready: boolean;
  missing: boolean;
  markDirty: () => void;
  finish: () => void;
};

const RoutineDraftContext = createContext<RoutineDraftValue | null>(null);

export function RoutineDraftProvider({ children }: { children: ReactNode }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { busy, error, routines } = useRoutineStore();
  const routine = id === "new" ? undefined : routines.find((item) => item.id === id);
  const [editedDraft, setDraft] = useState<RoutineDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const disablePrevention = usePreventRemove(
    !leaving && (dirty || editedDraft !== null),
    ({ repeat }) => {
      Alert.alert(
        "Abandonner les modifications ?",
        "Vos modifications ne seront pas enregistrées.",
        [
          { text: "Continuer la saisie", style: "cancel" },
          {
            text: "Abandonner",
            style: "destructive",
            onPress: () => {
              setLeaving(true);
              repeat();
            },
          },
        ],
      );
    },
  );

  const initialDraft = useMemo<RoutineDraft | null>(() => {
    if (id === "new") {
      return {
        productName: "",
        frequency: { kind: FrequencyKind.weekdays, days: [0, 1, 2, 3, 4, 5, 6] },
        time: "08:00",
      };
    }

    if (routine) {
      return {
        productName: routine.productName,
        frequency: routine.frequency,
        time: routine.time,
      };
    }

    return null;
  }, [id, routine]);

  const draft = editedDraft ?? initialDraft;
  const missing = !busy && !error && id !== "new" && !routine && !editedDraft;

  const value = useMemo(
    () => ({
      draft,
      setDraft,
      ready: draft !== null,
      missing,
      markDirty: () => setDirty(true),
      finish: () => {
        setLeaving(true);
        disablePrevention();
        router.dismissTo(id === "new" ? "/" : `/routine-detail/${id}`);
      },
    }),
    [disablePrevention, draft, id, missing],
  );

  return <RoutineDraftContext.Provider value={value}>{children}</RoutineDraftContext.Provider>;
}

export function useRoutineDraft() {
  const value = useContext(RoutineDraftContext);

  if (!value) throw new Error("useRoutineDraft must be used inside RoutineDraftProvider.");

  return value;
}
