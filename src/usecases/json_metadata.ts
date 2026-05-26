import { AppError } from "./app_error.ts";

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonRecord = Record<string, JsonValue>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown, depth: number): value is JsonValue {
  if (depth > 8) return false;
  if (value === null) return true;

  const valueType = typeof value;
  if (valueType === "string" || valueType === "boolean") return true;
  if (valueType === "number") return Number.isFinite(value);

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item, depth + 1));
  }

  if (isRecord(value)) {
    return Object.entries(value).every(
      ([key, item]) => key.length > 0 && key.length <= 120 && isJsonValue(item, depth + 1),
    );
  }

  return false;
}

export function normalizeJsonMetadata<TError extends string>(
  metadata: unknown,
  errorType: TError,
): JsonRecord | undefined {
  if (metadata === undefined || metadata === null) return undefined;

  if (!isRecord(metadata) || !isJsonValue(metadata, 0)) {
    throw new AppError<TError>(errorType, "metadata must be a JSON object.", 400);
  }

  const encodedMetadata = JSON.stringify(metadata);
  if (encodedMetadata.length > 16_384) {
    throw new AppError<TError>(errorType, "metadata must be 16 KB or smaller.", 400);
  }

  return metadata as JsonRecord;
}
