import { db } from "../../../db/client.ts";
import { users } from "../../../db/schema.ts";
import { eq } from "drizzle-orm";
import { AppError } from "../../app_error.ts";
import { normalizeAdminId, requireActiveAdmin } from "../admin_authorization.ts";
import { isValidUuid } from "../../../utils/validation.ts";

export type DeleteAdminUserInput = {
  adminId: string;
  userId: string;
  confirmation: string;
  reason?: string;
};

export async function deleteAdminUser(input: DeleteAdminUserInput): Promise<void> {
  const adminId = normalizeAdminId(input.adminId);
  await requireActiveAdmin(adminId);

  const userId = input.userId?.trim();
  if (!userId || !isValidUuid(userId)) {
    throw new AppError("INVALID_USER_ID", "Invalid user ID format.", 400);
  }

  // Prevent self-deletion
  if (adminId === userId) {
    throw new AppError("UNSAFE_SELF_DELETE", "Admins cannot delete their own account.", 403);
  }

  const confirmation = input.confirmation?.trim();
  if (confirmation !== "DELETE") {
    throw new AppError("INVALID_CONFIRMATION", "Confirmation must be exactly DELETE.", 400);
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!existing) {
    throw new AppError("USER_NOT_FOUND", "User not found.", 404);
  }

  try {
    await db.delete(users).where(eq(users.id, userId));
  } catch (error: unknown) {
    console.error("[ERROR] Unexpected error in deleteAdminUser:", error);
    throw new AppError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
