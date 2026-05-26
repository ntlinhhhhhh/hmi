import { db } from "../../../db/client.ts";
import { listAdminContentRows } from "../../../db/queries/admin_content_queries.ts";
import { AppError } from "../../app_error.ts";
import { normalizeAdminId, requireActiveAdmin } from "../admin_authorization.ts";
import { toContentResult, type ContentResult } from "../../content/content_models.ts";

export type ListAdminContentsInput = {
  adminId: string;
  type?: string;
  status?: string;
  search?: string;
  cursor?: string;
  limit?: number;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function listAdminContents(
  input: ListAdminContentsInput,
): Promise<{ contents: ContentResult[]; nextCursor: string | null }> {
  const adminId = normalizeAdminId(input.adminId);
  await requireActiveAdmin(adminId);

  let limit = DEFAULT_LIMIT;
  if (input.limit !== undefined) {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > MAX_LIMIT) {
      throw new AppError("INVALID_LIMIT", `Limit must be an integer from 1 to ${MAX_LIMIT}.`, 400);
    }
    limit = input.limit;
  }

  if (input.type && !["LECTURE", "QUIZ", "GAME"].includes(input.type)) {
    throw new AppError("INVALID_TYPE", "Type must be LECTURE, QUIZ, or GAME.", 400);
  }
  if (input.status && !["DRAFT", "PUBLISHED"].includes(input.status)) {
    throw new AppError("INVALID_STATUS", "Status must be DRAFT or PUBLISHED.", 400);
  }

  const rows = await listAdminContentRows(db, {
    type: input.type,
    status: input.status,
    search: input.search,
    cursor: input.cursor,
    limit: limit + 1,
  });

  const hasNextPage = rows.length > limit;
  const slicedRows = hasNextPage ? rows.slice(0, limit) : rows;

  const contents: ContentResult[] = slicedRows.map((row) => toContentResult(row as any));

  const lastRow = slicedRows[slicedRows.length - 1];
  const nextCursor = hasNextPage && lastRow ? lastRow.createdAt : null;

  return {
    contents,
    nextCursor,
  };
}
