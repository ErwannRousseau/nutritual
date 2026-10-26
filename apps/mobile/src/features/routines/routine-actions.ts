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

  setFeedback("Impossible de modifier la routine. Réessayez.");

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

  setFeedback("Impossible de supprimer la routine. Réessayez.");

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
    else setSaveError(storeError ?? "La routine n’a pas pu être enregistrée. Réessayez.");
  } catch (cause) {
    setSaveError(
      cause instanceof Error ? cause.message : "La routine n’a pas pu être enregistrée.",
    );
  } finally {
    setSaving(false);
  }
}
