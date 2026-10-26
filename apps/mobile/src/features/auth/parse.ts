export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

export interface JsonObject {
  [key: string]: JsonValue;
}

export function isJsonObject(value: JsonValue): value is JsonObject {
  return value instanceof Object && !Array.isArray(value);
}

export function normalizePairCode(value: string | null | undefined): string | null {
  const code = value?.trim().toUpperCase();

  return code && code.length <= 32 && /^[A-Z0-9-]+$/.test(code) ? code : null;
}
