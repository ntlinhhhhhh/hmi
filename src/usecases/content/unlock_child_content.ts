import { db, withTx } from "../../db/client.ts";
import {
  findPublishedContentDetailById,
  getChildContentUnlockByContentId,
} from "../../db/queries/learning_queries.ts";
import { unlockPremiumContentTx } from "../../db/queries/store_queries.ts";
import { AppError } from "../app_error.ts";
import {
  normalizeUseCaseUuid,
  requireOwnedActiveParentChild,
  type ParentChildAccessErrorType,
} from "../parent_child_access.ts";
import { getPgConstraintName, isPgErrorCode, PgErrorCode } from "../postgres_error.ts";
import { getContentUnlockStarCost } from "./content_models.ts";

export type UnlockChildContentErrorType =
  | ParentChildAccessErrorType
  | "MISSING_CONTENT_ID"
  | "INVALID_CONTENT_ID"
  | "CONTENT_NOT_FOUND"
  | "CONTENT_ALREADY_UNLOCKED"
  | "INSUFFICIENT_STARS"
  | "INTERNAL_ERROR";

export type UnlockChildContentInput = {
  parentId: string;
  childId: string;
  contentId: string;
};

export type UnlockChildContentResult = {
  childTotalStars: number;
  unlock: {
    id: string;
    childId: string;
    contentId: string;
    unlockedAt: string;
  };
};

function mapUnlockWriteError(error: unknown): AppError<UnlockChildContentErrorType> | null {
  if (isPgErrorCode(error, PgErrorCode.UNIQUE_VIOLATION)) {
    const constraint = getPgConstraintName(error);
    if (constraint === "unlock_content_unique_pair") {
      return new AppError<UnlockChildContentErrorType>(
        "CONTENT_ALREADY_UNLOCKED",
        "Content is already unlocked for this child.",
        409,
      );
    }
  }

  if (isPgErrorCode(error, PgErrorCode.FOREIGN_KEY_VIOLATION)) {
    const constraint = getPgConstraintName(error);
    if (constraint === "unlock_content_child_id_fkey") {
      return new AppError<UnlockChildContentErrorType>(
        "CHILD_NOT_FOUND",
        "Child profile not found.",
        404,
      );
    }

    if (constraint === "unlock_content_content_id_fkey") {
      return new AppError<UnlockChildContentErrorType>(
        "CONTENT_NOT_FOUND",
        "Published content not found.",
        404,
      );
    }
  }

  return null;
}

export async function unlockChildContent(
  input: UnlockChildContentInput,
): Promise<UnlockChildContentResult> {
  const parentId = normalizeUseCaseUuid(
    input.parentId,
    "MISSING_PARENT_ID",
    "INVALID_PARENT_ID",
    "parent ID",
  );
  const childId = normalizeUseCaseUuid(
    input.childId,
    "MISSING_CHILD_ID",
    "INVALID_CHILD_ID",
    "child ID",
  );
  const contentId = normalizeUseCaseUuid(
    input.contentId,
    "MISSING_CONTENT_ID",
    "INVALID_CONTENT_ID",
    "content ID",
  );

  try {
    const child = await requireOwnedActiveParentChild({ parentId, childId });
    const content = await findPublishedContentDetailById(db, contentId);

    if (!content) {
      throw new AppError<UnlockChildContentErrorType>(
        "CONTENT_NOT_FOUND",
        "Published content not found.",
        404,
      );
    }

    const existingUnlock = await getChildContentUnlockByContentId(db, childId, contentId);
    if (existingUnlock) {
      throw new AppError<UnlockChildContentErrorType>(
        "CONTENT_ALREADY_UNLOCKED",
        "Content is already unlocked for this child.",
        409,
      );
    }

    const cost = getContentUnlockStarCost(content);
    if (child.totalStars < cost) {
      throw new AppError<UnlockChildContentErrorType>(
        "INSUFFICIENT_STARS",
        "Child does not have enough stars to unlock this content.",
        409,
      );
    }

    const purchase = await withTx(async (tx) =>
      unlockPremiumContentTx(tx, childId, contentId, cost),
    );

    if (!purchase) {
      throw new AppError<UnlockChildContentErrorType>(
        "INSUFFICIENT_STARS",
        "Child does not have enough stars to unlock this content.",
        409,
      );
    }

    return {
      childTotalStars: purchase.childTotalStars,
      unlock: {
        id: purchase.unlock.id,
        childId: purchase.unlock.childId,
        contentId: purchase.unlock.contentId,
        unlockedAt: purchase.unlock.unlockedAt,
      },
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    const mappedError = mapUnlockWriteError(error);
    if (mappedError) {
      throw mappedError;
    }

    console.error("[ERROR] Unexpected error in use case: Unlock child content", error);
    throw new AppError<UnlockChildContentErrorType>(
      "INTERNAL_ERROR",
      "Internal server error.",
      500,
    );
  }
}
