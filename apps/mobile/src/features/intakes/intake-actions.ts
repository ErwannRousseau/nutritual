type FeedbackSetter = (message: string | null) => void;

type BooleanSetter = (value: boolean) => void;

export async function recordIntakeAction(
  id: string,
  selected: boolean,
  disabled: boolean,
  record: (id: string) => Promise<boolean>,
  setSaving: BooleanSetter,
  setFeedback: FeedbackSetter,
): Promise<boolean> {
  if (!selected || disabled) return false;
  setSaving(true);
  setFeedback(null);

  try {
    if (await record(id)) return true;
  } catch {
    // Keep the screen's existing failure message for provider errors.
  } finally {
    setSaving(false);
  }

  setFeedback("Impossible d’enregistrer la prise. Réessayez.");

  return false;
}

export async function undoIntakeAction(
  id: string,
  disabled: boolean,
  undo: (id: string) => Promise<boolean>,
  setUndoing: BooleanSetter,
  setFeedback: FeedbackSetter,
): Promise<boolean> {
  if (disabled) return false;
  setUndoing(true);
  setFeedback(null);

  try {
    if (await undo(id)) return true;
  } catch {
    // Keep the screen's existing failure message for provider errors.
  } finally {
    setUndoing(false);
  }

  setFeedback("Impossible d’annuler cette prise. Réessayez.");

  return false;
}
