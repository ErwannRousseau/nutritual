import { ListRoutinesStatus, type ListRoutinesResult } from "@nutritual/protocol";
import { loadData } from "@/features/routines/storage";

export async function listRoutinesFromRelay(): Promise<ListRoutinesResult> {
  try {
    return { status: ListRoutinesStatus.ok, routines: (await loadData()).routines };
  } catch {
    return { status: ListRoutinesStatus.failed, message: "Unable to read routines on this phone." };
  }
}
