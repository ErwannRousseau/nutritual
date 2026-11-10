export function parsePositiveAmount(value: string): number | null {
  const normalized = value.trim();

  if (!/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(normalized)) return null;

  const amount = Number(normalized.replace(",", "."));

  return Number.isFinite(amount) && amount > 0 ? amount : null;
}
