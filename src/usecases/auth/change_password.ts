import { db } from "../../db/client.ts";
import { getUserById, updateUserProfile } from "../../db/queries/user_queries.ts";
import { isValidUuid } from "../../utils/validation.ts";
import { AppError } from "../app_error.ts";

export type ChangePasswordErrorType =
  | "MISSING_USER_ID"
  | "INVALID_USER_ID"
  | "USER_NOT_FOUND"
  | "ACCOUNT_BANNED"
  | "UNSUPPORTED_AUTH_PROVIDER"
  | "MISSING_CURRENT_PASSWORD"
  | "MISSING_NEW_PASSWORD"
  | "WEAK_PASSWORD"
  | "SAME_PASSWORD"
  | "INVALID_CURRENT_PASSWORD"
  | "INTERNAL_ERROR";

export type ChangePasswordInput = {
  userId: string;
  currentPassword: string;
  newPassword: string;
};

function normalizeUserId(userId: string): string {
  const value = userId.trim();

  if (!value) {
    throw new AppError<ChangePasswordErrorType>("MISSING_USER_ID", "User ID is required.", 400);
  }

  if (!isValidUuid(value)) {
    throw new AppError<ChangePasswordErrorType>("INVALID_USER_ID", "Invalid user ID format.", 400);
  }

  return value;
}

function requireCurrentPassword(currentPassword: string): string {
  if (!currentPassword) {
    throw new AppError<ChangePasswordErrorType>(
      "MISSING_CURRENT_PASSWORD",
      "Current password is required.",
      400,
    );
  }

  return currentPassword;
}

function validateNewPassword(currentPassword: string, newPassword: string): string {
  if (!newPassword) {
    throw new AppError<ChangePasswordErrorType>(
      "MISSING_NEW_PASSWORD",
      "New password is required.",
      400,
    );
  }

  if (newPassword.length < 8) {
    throw new AppError<ChangePasswordErrorType>(
      "WEAK_PASSWORD",
      "New password must be at least 8 characters.",
      400,
    );
  }

  if (newPassword === currentPassword) {
    throw new AppError<ChangePasswordErrorType>(
      "SAME_PASSWORD",
      "New password must be different from the current password.",
      400,
    );
  }

  return newPassword;
}

export async function changePassword(input: ChangePasswordInput): Promise<void> {
  const userId = normalizeUserId(input.userId);
  const currentPassword = requireCurrentPassword(input.currentPassword);
  const newPassword = validateNewPassword(currentPassword, input.newPassword);

  try {
    const user = await getUserById(db, userId);

    if (!user) {
      throw new AppError<ChangePasswordErrorType>("USER_NOT_FOUND", "User not found.", 404);
    }

    if (user.status === "BANNED") {
      throw new AppError<ChangePasswordErrorType>("ACCOUNT_BANNED", "Account is banned.", 403);
    }

    if (user.authProvider !== "LOCAL" || !user.passwordHash) {
      throw new AppError<ChangePasswordErrorType>(
        "UNSUPPORTED_AUTH_PROVIDER",
        "This account does not support local password changes.",
        403,
      );
    }

    const isCurrentPasswordValid = await Bun.password.verify(currentPassword, user.passwordHash);

    if (!isCurrentPasswordValid) {
      throw new AppError<ChangePasswordErrorType>(
        "INVALID_CURRENT_PASSWORD",
        "Current password is incorrect.",
        401,
      );
    }

    const passwordHash = await Bun.password.hash(newPassword, {
      algorithm: "argon2id",
    });

    await updateUserProfile(db, userId, { passwordHash });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("[ERROR] Unexpected error in use case: Change password", error);
    throw new AppError<ChangePasswordErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
