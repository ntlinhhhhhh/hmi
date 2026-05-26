import { db } from "../../../db/client.ts";
import { getAdminContentDetailRow } from "../../../db/queries/admin_content_queries.ts";
import { AppError } from "../../app_error.ts";
import { normalizeAdminId, requireActiveAdmin } from "../admin_authorization.ts";
import { toContentResult, type ContentResult } from "../../content/content_models.ts";
import { isValidUuid } from "../../../utils/validation.ts";

export type GetAdminContentDetailInput = {
  adminId: string;
  contentId: string;
};

export async function getAdminContentDetail(input: GetAdminContentDetailInput): Promise<ContentResult> {
  const adminId = normalizeAdminId(input.adminId);
  await requireActiveAdmin(adminId);

  const contentId = input.contentId?.trim();
  if (!contentId || !isValidUuid(contentId)) {
    throw new AppError("INVALID_CONTENT_ID", "Invalid content ID format.", 400);
  }

  try {
    const row = await getAdminContentDetailRow(db, contentId);
    if (!row) {
      throw new AppError("CONTENT_NOT_FOUND", "Content not found.", 404);
    }

    return toContentResult(row as any);
  } catch (error: unknown) {
    if (error instanceof AppError) throw error;
    console.error("[ERROR] Unexpected error in getAdminContentDetail:", error);
    throw new AppError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
