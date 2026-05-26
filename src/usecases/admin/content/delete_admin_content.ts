import { db } from "../../../db/client.ts";
import { getAdminContentDetailRow, softDeleteAdminContentRow } from "../../../db/queries/admin_content_queries.ts";
import { AppError } from "../../app_error.ts";
import { normalizeAdminId, requireActiveAdmin } from "../admin_authorization.ts";
import { isValidUuid } from "../../../utils/validation.ts";

export type DeleteAdminContentInput = {
  adminId: string;
  contentId: string;
  confirmation: string;
};

export async function deleteAdminContent(input: DeleteAdminContentInput): Promise<void> {
  const adminId = normalizeAdminId(input.adminId);
  await requireActiveAdmin(adminId);

  const contentId = input.contentId?.trim();
  if (!contentId || !isValidUuid(contentId)) {
    throw new AppError("INVALID_CONTENT_ID", "Invalid content ID format.", 400);
  }

  const confirmation = input.confirmation?.trim();
  if (confirmation !== "DELETE") {
    throw new AppError("INVALID_CONFIRMATION", "Confirmation must be exactly DELETE.", 400);
  }

  const existing = await getAdminContentDetailRow(db, contentId);
  if (!existing) {
    throw new AppError("CONTENT_NOT_FOUND", "Content not found.", 404);
  }

  try {
    await softDeleteAdminContentRow(db, contentId);
  } catch (error: unknown) {
    console.error("[ERROR] Unexpected error in deleteAdminContent:", error);
    throw new AppError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
