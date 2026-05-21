import { DrizzleQueryError } from "drizzle-orm/errors";

export const PgErrorCode = {
  UNIQUE_VIOLATION: "23505",
  INVALID_TEXT_REPRESENTATION: "22P02",
} as const;

export type PgErrorCodeType = (typeof PgErrorCode)[keyof typeof PgErrorCode];

type PgLikeError = Error & {
  code?: string;
  constraint?: string;
  constraint_name?: string;
};

function unwrapDbError(error: unknown): PgLikeError | null {
  if (
    error instanceof DrizzleQueryError &&
    error.cause &&
    typeof error.cause === "object"
  ) {
    return error.cause as PgLikeError;
  }

  if (error instanceof Error && "code" in error) {
    return error as PgLikeError;
  }

  return null;
}

export function getPgErrorCode(error: unknown): string | null {
  const pgError = unwrapDbError(error);
  return pgError?.code ?? null;
}

export function isPgErrorCode(error: unknown, code: PgErrorCodeType): boolean {
  return getPgErrorCode(error) === code;
}

export function getPgConstraintName(error: unknown): string | null {
  const pgError = unwrapDbError(error);
  return pgError?.constraint ?? pgError?.constraint_name ?? null;
}
