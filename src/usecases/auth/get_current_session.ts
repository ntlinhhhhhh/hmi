import { db } from "../../db/client.ts";
import {
  getActiveSessionByTokenHash,
  touchSession,
} from "../../db/queries/session_queries.ts";
import { AppError } from "../app_error.ts";
import { hashSessionToken, normalizeSessionToken } from "./session_token.ts";

export type CurrentSessionErrorType =
  | "MISSING_SESSION_TOKEN"
  | "INVALID_SESSION"
  | "ACCOUNT_BANNED"
  | "INTERNAL_ERROR";

export type CurrentSessionResult = {
  sessionId: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    phoneNumber: string | null;
    fullName: string | null;
    role: string;
    status: string;
    lastLoginAt: string | null;
    createdAt: string;
  };
};

export async function getCurrentSession(
  sessionToken: string,
): Promise<CurrentSessionResult> {
  const normalizedSessionToken = normalizeSessionToken(sessionToken);

  if (!normalizedSessionToken) {
    throw new AppError<CurrentSessionErrorType>(
      "MISSING_SESSION_TOKEN",
      "Valid session token is required.",
      401,
    );
  }

  try {
    const session = await getActiveSessionByTokenHash(
      db,
      hashSessionToken(normalizedSessionToken),
    );

    if (!session) {
      throw new AppError<CurrentSessionErrorType>(
        "INVALID_SESSION",
        "Session is invalid or expired.",
        401,
      );
    }

    if (session.user.status === "BANNED") {
      throw new AppError<CurrentSessionErrorType>(
        "ACCOUNT_BANNED",
        "Account is banned.",
        403,
      );
    }

    await touchSession(db, session.id);

    return {
      sessionId: session.id,
      expiresAt: session.expiresAt,
      user: {
        id: session.user.id,
        email: session.user.email,
        phoneNumber: session.user.phoneNumber ?? null,
        fullName: session.user.fullName ?? null,
        role: session.user.role,
        status: session.user.status,
        lastLoginAt: session.user.lastLoginAt ?? null,
        createdAt: session.user.createdAt,
      },
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error(
      "[ERROR] Unexpected error in use case: Get current session",
      error,
    );
    throw new AppError<CurrentSessionErrorType>(
      "INTERNAL_ERROR",
      "Internal server error.",
      500,
    );
  }
}
