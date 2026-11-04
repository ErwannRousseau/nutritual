import type { ListRoutinesResult } from "@nutritual/protocol";
import { loadData } from "@/features/routines/storage";

export async function listRoutinesFromRelay(): Promise<ListRoutinesResult> {
  try {
    return { status: "ok", routines: (await loadData()).routines };
  } catch {
    return { status: "failed", message: "Unable to read routines on this phone." };
  }
}
