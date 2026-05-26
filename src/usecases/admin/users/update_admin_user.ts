import { db } from "../../../db/client.ts";
import { users } from "../../../db/schema.ts";
import { eq, sql } from "drizzle-orm";
import { AppError } from "../../app_error.ts";
import { normalizeAdminId, requireActiveAdmin } from "../admin_authorization.ts";
import { isValidUuid } from "../../../utils/validation.ts";
import { toAdminUserResult, type AdminUserResult } from "./admin_user_models.ts";

export type UpdateAdminUserInput = {
  adminId: string;
  userId: string;
  status?: string;
  role?: string;
};

export async function updateAdminUser(input: UpdateAdminUserInput): Promise<AdminUserResult> {
  const adminId = normalizeAdminId(input.adminId);
  await requireActiveAdmin(adminId);

  const userId = input.userId?.trim();
  if (!userId || !isValidUuid(userId)) {
    throw new AppError("INVALID_USER_ID", "Invalid user ID format.", 400);
  }

  // Prevent self-modifications (self-ban or self-demotion)
  if (adminId === userId) {
    throw new AppError("UNSAFE_SELF_CHANGE", "Admins cannot modify their own status or role.", 403);
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!existing) {
    throw new AppError("USER_NOT_FOUND", "User not found.", 404);
  }

  const updateData: any = {};

  if (input.status !== undefined) {
    const status = input.status.trim().toUpperCase();
    if (!["ACTIVE", "BANNED"].includes(status)) {
      throw new AppError("INVALID_STATUS", "Status must be ACTIVE or BANNED.", 400);
    }
    updateData.status = status;
  }

  if (input.role !== undefined) {
    const role = input.role.trim().toUpperCase();
    if (!["PARENT", "ADMIN"].includes(role)) {
      throw new AppError("INVALID_ROLE", "Role must be PARENT or ADMIN.", 400);
    }
    updateData.role = role;
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError("MISSING_UPDATE_FIELDS", "At least one update field (status, role) is required.", 400);
  }

  try {
    const [updated] = await db
      .update(users)
      .set({
        ...updateData,
        updatedAt: sql`NOW()`,
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) throw new Error("Failed to update user.");

    return toAdminUserResult(updated as any);
  } catch (error: unknown) {
    if (error instanceof AppError) throw error;
    console.error("[ERROR] Unexpected error in updateAdminUser:", error);
    throw new AppError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
