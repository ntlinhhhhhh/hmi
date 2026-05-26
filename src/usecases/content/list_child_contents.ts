import { db } from "../../db/client.ts";
import {
  getChildContentProgressRows,
  getChildContentUnlocks,
  getPublishedContentCatalog,
} from "../../db/queries/learning_queries.ts";
import { AppError } from "../app_error.ts";
import {
  normalizeUseCaseUuid,
  requireOwnedActiveParentChild,
  type ParentChildAccessErrorType,
} from "../parent_child_access.ts";
import {
  getContentDifficultyLevel,
  isContentType,
  toContentResult,
  type ContentProgressSummary,
  type ContentResult,
  type ContentType,
} from "./content_models.ts";

export type ListChildContentsErrorType =
  | ParentChildAccessErrorType
  | "INVALID_CONTENT_TYPE"
  | "INVALID_DIFFICULTY_LEVEL"
  | "INTERNAL_ERROR";

export type ListChildContentsInput = {
  parentId: string;
  childId: string;
  type?: string;
  difficultyLevel?: number;
  includeLocked?: boolean;
};

function normalizeContentType(type: string | undefined): ContentType | undefined {
  if (type === undefined || type.trim() === "") return undefined;

  const normalizedType = type.trim().toUpperCase();
  if (!isContentType(normalizedType)) {
    throw new AppError<ListChildContentsErrorType>(
      "INVALID_CONTENT_TYPE",
      "Content type must be LECTURE, QUIZ, or GAME.",
      400,
    );
  }

  return normalizedType;
}

function normalizeDifficultyLevel(difficultyLevel: number | undefined): number | undefined {
  if (difficultyLevel === undefined) return undefined;

  if (!Number.isInteger(difficultyLevel) || difficultyLevel < 1 || difficultyLevel > 3) {
    throw new AppError<ListChildContentsErrorType>(
      "INVALID_DIFFICULTY_LEVEL",
      "Difficulty level must be an integer from 1 to 3.",
      400,
    );
  }

  return difficultyLevel;
}

function buildProgressMap(rows: Awaited<ReturnType<typeof getChildContentProgressRows>>) {
  const progressByContentId = new Map<string, ContentProgressSummary>();

  for (const row of rows) {
    progressByContentId.set(row.contentId, {
      totalSessions: Number(row.totalSessions ?? 0),
      completedSessions: Number(row.completedSessions ?? 0),
      starsEarned: Number(row.starsEarned ?? 0),
      lastSessionAt: row.lastSessionAt ?? null,
    });
  }

  return progressByContentId;
}

export async function listChildContents(input: ListChildContentsInput): Promise<ContentResult[]> {
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
  const type = normalizeContentType(input.type);
  const difficultyLevel = normalizeDifficultyLevel(input.difficultyLevel);
  const includeLocked = input.includeLocked ?? true;

  try {
    await requireOwnedActiveParentChild({ parentId, childId });

    const [contents, unlocks, progressRows] = await Promise.all([
      getPublishedContentCatalog(db, { type }),
      getChildContentUnlocks(db, childId),
      getChildContentProgressRows(db, childId),
    ]);

    const unlockByContentId = new Map(
      unlocks.map((unlock) => [unlock.contentId, { id: unlock.id, unlockedAt: unlock.unlockedAt }]),
    );
    const progressByContentId = buildProgressMap(progressRows);

    return contents
      .filter((content) => {
        if (difficultyLevel === undefined) return true;
        return getContentDifficultyLevel(content) === difficultyLevel;
      })
      .filter((content) => includeLocked || unlockByContentId.has(content.id))
      .map((content) =>
        toContentResult(content, {
          unlock: unlockByContentId.get(content.id) ?? null,
          progress: progressByContentId.get(content.id) ?? null,
        }),
      );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("[ERROR] Unexpected error in use case: List child contents", error);
    throw new AppError<ListChildContentsErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
