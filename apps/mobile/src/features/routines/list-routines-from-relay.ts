import { ListRoutinesStatus, type ListRoutinesResult } from "@nutritual/protocol";
import type { Routine } from "@/features/routines/model";
import { loadData } from "@/features/routines/storage";

function listedRoutine({ id, productName, frequency, time, paused, form, quantity }: Routine) {
  return {
    id,
    productName,
    frequency,
    time,
    paused,
    form,
    quantity,
  };
}

export async function listRoutinesFromRelay(): Promise<ListRoutinesResult> {
  try {
    return {
      status: ListRoutinesStatus.ok,
      routines: (await loadData()).routines.map(listedRoutine),
    };
  } catch {
    return { status: ListRoutinesStatus.failed, message: "Unable to read routines on this phone." };
  }
}
