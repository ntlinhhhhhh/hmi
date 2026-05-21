import { db } from "../../db/client.ts";
import { deleteSessionByTokenHash } from "../../db/queries/session_queries.ts";
import { AppError } from "../app_error.ts";
import { hashSessionToken, normalizeSessionToken } from "./session_token.ts";

export type SignOutErrorType =
  | "MISSING_SESSION_TOKEN"
  | "INVALID_SESSION"
  | "INTERNAL_ERROR";

export async function signOut(sessionToken: string): Promise<void> {
  const normalizedSessionToken = normalizeSessionToken(sessionToken);

  if (!normalizedSessionToken) {
    throw new AppError<SignOutErrorType>(
      "MISSING_SESSION_TOKEN",
      "Valid session token is required.",
      401,
    );
  }

  try {
    const deleted = await deleteSessionByTokenHash(
      db,
      hashSessionToken(normalizedSessionToken),
    );

    if (!deleted) {
      throw new AppError<SignOutErrorType>(
        "INVALID_SESSION",
        "Session is invalid or already signed out.",
        401,
      );
    }
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("[ERROR] Unexpected error in use case: Sign out", error);
    throw new AppError<SignOutErrorType>(
      "INTERNAL_ERROR",
      "Internal server error.",
      500,
    );
  }
}
