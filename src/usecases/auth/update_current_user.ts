import { db } from "../../db/client.ts";
import { getUserById, updateUserProfile } from "../../db/queries/user_queries.ts";
import { isValidEmail, isValidUuid } from "../../utils/validation.ts";
import { AppError } from "../app_error.ts";
import { getPgConstraintName, isPgErrorCode, PgErrorCode } from "../postgres_error.ts";

export type UpdateCurrentUserErrorType =
  | "MISSING_USER_ID"
  | "INVALID_USER_ID"
  | "USER_NOT_FOUND"
  | "ACCOUNT_BANNED"
  | "MISSING_UPDATE_FIELDS"
  | "INVALID_EMAIL"
  | "INVALID_PHONE_NUMBER"
  | "INVALID_FULL_NAME"
  | "EMAIL_TAKEN"
  | "PHONE_NUMBER_TAKEN"
  | "IDENTIFIER_ALREADY_IN_USE"
  | "INTERNAL_ERROR";

export type UpdateCurrentUserInput = {
  userId: string;
  email?: string;
  phoneNumber?: string | null;
  fullName?: string | null;
};

export type CurrentUserProfileResult = {
  id: string;
  email: string;
  phoneNumber: string | null;
  fullName: string | null;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type NormalizedProfilePatch = {
  email?: string;
  phoneNumber?: string | null;
  fullName?: string | null;
};

function normalizeUserId(userId: string): string {
  const value = userId.trim();

  if (!value) {
    throw new AppError<UpdateCurrentUserErrorType>("MISSING_USER_ID", "User ID is required.", 400);
  }

  if (!isValidUuid(value)) {
    throw new AppError<UpdateCurrentUserErrorType>(
      "INVALID_USER_ID",
      "Invalid user ID format.",
      400,
    );
  }

  return value;
}

function normalizeEmail(email: string | undefined): string | undefined {
  if (email === undefined) return undefined;

  const value = email.trim().toLowerCase();

  if (!isValidEmail(value)) {
    throw new AppError<UpdateCurrentUserErrorType>("INVALID_EMAIL", "Invalid email format.", 400);
  }

  return value;
}

function normalizePhoneNumber(phoneNumber: string | null | undefined): string | null | undefined {
  if (phoneNumber === undefined) return undefined;
  if (phoneNumber === null) return null;

  const value = phoneNumber.trim().replace(/[\s().-]/g, "");
  if (!value) return null;

  if (!/^\+?[0-9]{8,15}$/.test(value)) {
    throw new AppError<UpdateCurrentUserErrorType>(
      "INVALID_PHONE_NUMBER",
      "Phone number must contain 8 to 15 digits and may start with '+'.",
      400,
    );
  }

  return value;
}

function normalizeFullName(fullName: string | null | undefined): string | null | undefined {
  if (fullName === undefined) return undefined;
  if (fullName === null) return null;

  const value = fullName.trim().replace(/\s+/g, " ");
  if (!value) return null;

  if (value.length > 120) {
    throw new AppError<UpdateCurrentUserErrorType>(
      "INVALID_FULL_NAME",
      "Full name must be 120 characters or fewer.",
      400,
    );
  }

  return value;
}

function normalizePatch(input: UpdateCurrentUserInput): NormalizedProfilePatch {
  const patch: NormalizedProfilePatch = {};
  const email = normalizeEmail(input.email);
  const phoneNumber = normalizePhoneNumber(input.phoneNumber);
  const fullName = normalizeFullName(input.fullName);

  if (email !== undefined) patch.email = email;
  if (phoneNumber !== undefined) patch.phoneNumber = phoneNumber;
  if (fullName !== undefined) patch.fullName = fullName;

  if (Object.keys(patch).length === 0) {
    throw new AppError<UpdateCurrentUserErrorType>(
      "MISSING_UPDATE_FIELDS",
      "At least one profile field is required.",
      400,
    );
  }

  return patch;
}

function mapUniqueViolation(error: unknown): AppError<UpdateCurrentUserErrorType> {
  const constraint = getPgConstraintName(error);

  if (constraint === "users_email_key") {
    return new AppError<UpdateCurrentUserErrorType>("EMAIL_TAKEN", "Email is already in use.", 409);
  }

  if (constraint === "users_phone_number_key") {
    return new AppError<UpdateCurrentUserErrorType>(
      "PHONE_NUMBER_TAKEN",
      "Phone number is already in use.",
      409,
    );
  }

  if (constraint && !constraint.startsWith("users_")) {
    return new AppError<UpdateCurrentUserErrorType>(
      "INTERNAL_ERROR",
      "Internal server error.",
      500,
    );
  }

  return new AppError<UpdateCurrentUserErrorType>(
    "IDENTIFIER_ALREADY_IN_USE",
    "Email or phone number is already in use.",
    409,
  );
}

export async function updateCurrentUser(
  input: UpdateCurrentUserInput,
): Promise<CurrentUserProfileResult> {
  const userId = normalizeUserId(input.userId);
  const patch = normalizePatch(input);

  try {
    const user = await getUserById(db, userId);

    if (!user) {
      throw new AppError<UpdateCurrentUserErrorType>("USER_NOT_FOUND", "User not found.", 404);
    }

    if (user.status === "BANNED") {
      throw new AppError<UpdateCurrentUserErrorType>("ACCOUNT_BANNED", "Account is banned.", 403);
    }

    const updatedUser = await updateUserProfile(db, userId, patch);

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      phoneNumber: updatedUser.phoneNumber ?? null,
      fullName: updatedUser.fullName ?? null,
      role: updatedUser.role,
      status: updatedUser.status,
      lastLoginAt: updatedUser.lastLoginAt ?? null,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    if (isPgErrorCode(error, PgErrorCode.UNIQUE_VIOLATION)) {
      throw mapUniqueViolation(error);
    }

    console.error("[ERROR] Unexpected error in use case: Update current user", error);
    throw new AppError<UpdateCurrentUserErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
