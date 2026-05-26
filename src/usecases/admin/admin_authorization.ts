import { getUserById } from "../../db/queries/user_queries.ts";
import { db } from "../../db/client.ts";
import { isValidUuid } from "../../utils/validation.ts";
import { AppError } from "../app_error.ts";

export type AdminAuthorizationErrorType =
  | "MISSING_ADMIN_ID"
  | "INVALID_ADMIN_ID"
  | "ADMIN_NOT_FOUND"
  | "ACCOUNT_BANNED"
  | "NOT_ADMIN";

export function normalizeAdminId(adminId: string): string {
  const value = adminId.trim();

  if (!value) {
    throw new AppError<AdminAuthorizationErrorType>(
      "MISSING_ADMIN_ID",
      "Admin ID is required.",
      400,
    );
  }

  if (!isValidUuid(value)) {
    throw new AppError<AdminAuthorizationErrorType>(
      "INVALID_ADMIN_ID",
      "Invalid admin ID format.",
      400,
    );
  }

  return value;
}

export async function requireActiveAdmin(adminId: string): Promise<void> {
  const admin = await getUserById(db, adminId);

  if (!admin) {
    throw new AppError<AdminAuthorizationErrorType>("ADMIN_NOT_FOUND", "Admin not found.", 404);
  }

  if (admin.status !== "ACTIVE") {
    throw new AppError<AdminAuthorizationErrorType>(
      "ACCOUNT_BANNED",
      "Admin account is not active.",
      403,
    );
  }

  if (admin.role !== "ADMIN") {
    throw new AppError<AdminAuthorizationErrorType>(
      "NOT_ADMIN",
      "Admin privileges are required.",
      403,
    );
  }
}
