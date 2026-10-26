import { validateRoutine, type RoutineDraft } from "@/features/routines/model";

type FeedbackSetter = (message: string | null) => void;

type BooleanSetter = (value: boolean) => void;

export async function pauseRoutine(
  id: string,
  busy: boolean,
  pause: (id: string) => Promise<boolean>,
  setFeedback: FeedbackSetter,
): Promise<boolean> {
  if (busy) return false;
  setFeedback(null);

  try {
    if (await pause(id)) return true;
  } catch {
    // Keep the screen's existing failure message for provider errors.
  }

  setFeedback("Unable to update the routine. Try again.");

  return false;
}

export async function removeRoutine(
  id: string,
  busy: boolean,
  remove: (id: string) => Promise<boolean>,
  setFeedback: FeedbackSetter,
): Promise<boolean> {
  if (busy) return false;
  setFeedback(null);

  try {
    if (await remove(id)) return true;
  } catch {
    // Keep the screen's existing failure message for provider errors.
  }

  setFeedback("Unable to delete the routine. Try again.");

  return false;
}

export async function saveRoutineDraft(
  draft: RoutineDraft | null,
  id: string | undefined,
  busy: boolean,
  storeError: string | null,
  save: (draft: RoutineDraft, id?: string) => Promise<boolean>,
  finish: () => void,
  setSaving: BooleanSetter,
  setSaveError: FeedbackSetter,
): Promise<void> {
  if (!draft || busy) return;

  const validation = validateRoutine(draft);

  if (validation) {
    setSaveError(validation);

    return;
  }

  setSaving(true);
  setSaveError(null);

  try {
    const saved = await save(draft, id);

    if (saved) finish();
    else setSaveError(storeError ?? "Unable to save the routine. Try again.");
  } catch (cause) {
    setSaveError(cause instanceof Error ? cause.message : "Unable to save the routine.");
  } finally {
    setSaving(false);
  }
}
