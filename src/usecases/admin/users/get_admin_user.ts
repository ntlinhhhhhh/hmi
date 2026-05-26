import { db } from "../../../db/client.ts";
import {
  getAdminUserRowById,
  getUserChildCount,
  getUserSessionSummary,
} from "../../../db/queries/admin_user_queries.ts";
import { AppError } from "../../app_error.ts";
import {
  normalizeAdminId,
  requireActiveAdmin,
  type AdminAuthorizationErrorType,
} from "../admin_authorization.ts";
import {
  normalizeUserId,
  toAdminUserResult,
  type AdminUserDetailResult,
} from "./admin_user_models.ts";

export type GetAdminUserErrorType =
  | AdminAuthorizationErrorType
  | "INVALID_USER_ID"
  | "USER_NOT_FOUND"
  | "INTERNAL_ERROR";

export type GetAdminUserInput = {
  adminId: string;
  userId: string;
};

export async function getAdminUser(input: GetAdminUserInput): Promise<AdminUserDetailResult> {
  const adminId = normalizeAdminId(input.adminId);
  const userId = normalizeUserId(input.userId, "INVALID_USER_ID");

  try {
    await requireActiveAdmin(adminId);

    const user = await getAdminUserRowById(db, userId);
    if (!user) {
      throw new AppError<GetAdminUserErrorType>("USER_NOT_FOUND", "User not found.", 404);
    }

    const [childCount, sessions] = await Promise.all([
      getUserChildCount(db, userId),
      getUserSessionSummary(db, userId),
    ]);

    return {
      user: toAdminUserResult(user),
      childCount,
      sessions,
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("[ERROR] Unexpected error in use case: Get admin user", error);
    throw new AppError<GetAdminUserErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
