import { db, withTx } from "../../db/client.ts";
import { createSession } from "../../db/queries/session_queries.ts";
import {
  findUserByIdentifier,
  markUserLoggedIn,
} from "../../db/queries/user_queries.ts";
import { AppError } from "../app_error.ts";
import {
  generateSessionToken,
  hashSessionToken,
  readSessionTtlMs,
} from "./session_token.ts";

export type SignInErrorType =
  | "MISSING_IDENTIFIER"
  | "MISSING_PASSWORD"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_BANNED"
  | "UNSUPPORTED_AUTH_PROVIDER"
  | "INTERNAL_ERROR";

export type SignInParentInput = {
  identifier: string;
  password: string;
};

export type SignInParentResult = {
  sessionId: string;
  sessionToken: string;
  expiresAt: string;
  id: string;
  email: string;
  phoneNumber: string | null;
  fullName: string | null;
  role: string;
  status: string;
  lastLoginAt: string | null;
};

function normalizeIdentifier(identifier: string): string {
  const value = identifier.trim();

  if (!value) {
    throw new AppError<SignInErrorType>(
      "MISSING_IDENTIFIER",
      "Email or phone number is required.",
      400,
    );
  }

  if (value.includes("@")) {
    return value.toLowerCase();
  }

  return value.replace(/[\s().-]/g, "");
}

function requirePassword(password: string): string {
  if (!password) {
    throw new AppError<SignInErrorType>(
      "MISSING_PASSWORD",
      "Password is required.",
      400,
    );
  }

  return password;
}

export async function signInParent(
  input: SignInParentInput,
): Promise<SignInParentResult> {
  const identifier = normalizeIdentifier(input.identifier);
  const password = requirePassword(input.password);

  try {
    const user = await findUserByIdentifier(db, identifier);

    if (!user?.passwordHash) {
      throw new AppError<SignInErrorType>(
        "INVALID_CREDENTIALS",
        "Invalid email/phone or password.",
        401,
      );
    }

    if (user.status === "BANNED") {
      throw new AppError<SignInErrorType>(
        "ACCOUNT_BANNED",
        "Account is banned.",
        403,
      );
    }

    if (user.authProvider !== "LOCAL") {
      throw new AppError<SignInErrorType>(
        "UNSUPPORTED_AUTH_PROVIDER",
        "Please sign in using the account provider used during registration.",
        401,
      );
    }

    const isValidPassword = await Bun.password.verify(
      password,
      user.passwordHash,
    );

    if (!isValidPassword) {
      throw new AppError<SignInErrorType>(
        "INVALID_CREDENTIALS",
        "Invalid email/phone or password.",
        401,
      );
    }

    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + readSessionTtlMs()).toISOString();

    const { session, updatedUser } = await withTx(async (tx) => {
      const updatedUser = await markUserLoggedIn(tx, user.id);
      const session = await createSession(tx, {
        userId: user.id,
        sessionTokenHash: hashSessionToken(sessionToken),
        expiresAt,
      });

      return { session, updatedUser };
    });

    return {
      sessionId: session.id,
      sessionToken,
      expiresAt: session.expiresAt,
      id: updatedUser.id,
      email: updatedUser.email,
      phoneNumber: updatedUser.phoneNumber ?? null,
      fullName: updatedUser.fullName ?? null,
      role: updatedUser.role,
      status: updatedUser.status,
      lastLoginAt: updatedUser.lastLoginAt ?? null,
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error(
      "[ERROR] Unexpected error in use case: Sign in parent",
      error,
    );
    throw new AppError<SignInErrorType>(
      "INTERNAL_ERROR",
      "Internal server error.",
      500,
    );
  }
}
