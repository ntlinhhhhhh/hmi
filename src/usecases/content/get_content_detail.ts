import { db } from "../../db/client.ts";
import {
  findPublishedContentDetailById,
  getChildContentProgressRows,
  getChildContentUnlockByContentId,
} from "../../db/queries/learning_queries.ts";
import { getUserById } from "../../db/queries/user_queries.ts";
import { AppError } from "../app_error.ts";
import {
  normalizeUseCaseUuid,
  requireOwnedActiveParentChild,
  type ParentChildAccessErrorType,
} from "../parent_child_access.ts";
import {
  toContentResult,
  type ContentProgressSummary,
  type ContentResult,
} from "./content_models.ts";

export type GetContentDetailErrorType =
  | ParentChildAccessErrorType
  | "MISSING_CONTENT_ID"
  | "INVALID_CONTENT_ID"
  | "USER_NOT_FOUND"
  | "ACCOUNT_BANNED"
  | "CONTENT_NOT_FOUND"
  | "INTERNAL_ERROR";

export type GetContentDetailInput = {
  userId: string;
  contentId: string;
  childId?: string;
};

function findContentProgress(
  rows: Awaited<ReturnType<typeof getChildContentProgressRows>>,
  contentId: string,
): ContentProgressSummary | null {
  const row = rows.find((progressRow) => progressRow.contentId === contentId);
  if (!row) return null;

  return {
    totalSessions: Number(row.totalSessions ?? 0),
    completedSessions: Number(row.completedSessions ?? 0),
    starsEarned: Number(row.starsEarned ?? 0),
    lastSessionAt: row.lastSessionAt ?? null,
  };
}

export async function getContentDetail(input: GetContentDetailInput): Promise<ContentResult> {
  const userId = normalizeUseCaseUuid(
    input.userId,
    "MISSING_PARENT_ID",
    "INVALID_PARENT_ID",
    "user ID",
  );
  const contentId = normalizeUseCaseUuid(
    input.contentId,
    "MISSING_CONTENT_ID",
    "INVALID_CONTENT_ID",
    "content ID",
  );
  const childId =
    input.childId === undefined
      ? undefined
      : normalizeUseCaseUuid(input.childId, "MISSING_CHILD_ID", "INVALID_CHILD_ID", "child ID");

  try {
    const user = await getUserById(db, userId);
    if (!user) {
      throw new AppError<GetContentDetailErrorType>("USER_NOT_FOUND", "User not found.", 404);
    }

    if (user.status !== "ACTIVE") {
      throw new AppError<GetContentDetailErrorType>(
        "ACCOUNT_BANNED",
        "User account is not active.",
        403,
      );
    }

    const content = await findPublishedContentDetailById(db, contentId);
    if (!content) {
      throw new AppError<GetContentDetailErrorType>(
        "CONTENT_NOT_FOUND",
        "Published content not found.",
        404,
      );
    }

    if (childId === undefined) {
      return toContentResult(content);
    }

    await requireOwnedActiveParentChild({ parentId: userId, childId });

    const [unlock, progressRows] = await Promise.all([
      getChildContentUnlockByContentId(db, childId, contentId),
      getChildContentProgressRows(db, childId),
    ]);

    return toContentResult(content, {
      unlock: unlock ? { id: unlock.id, unlockedAt: unlock.unlockedAt } : null,
      progress: findContentProgress(progressRows, contentId),
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("[ERROR] Unexpected error in use case: Get content detail", error);
    throw new AppError<GetContentDetailErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
