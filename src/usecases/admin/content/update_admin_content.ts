import { withTx, db } from "../../../db/client.ts";
import { getAdminContentDetailRow, updateAdminContentRow } from "../../../db/queries/admin_content_queries.ts";
import { AppError } from "../../app_error.ts";
import { normalizeAdminId, requireActiveAdmin } from "../admin_authorization.ts";
import { toContentResult, type ContentResult } from "../../content/content_models.ts";
import { isValidUuid } from "../../../utils/validation.ts";

export type UpdateAdminContentInput = {
  adminId: string;
  contentId: string;
  title?: string;
  status?: string;
  lecture?: {
    mediaUrl?: string;
    description?: string | null;
    difficultyLevel?: number;
    isDefault?: boolean;
  };
  quiz?: {
    mediaUrl?: string;
    description?: string | null;
    difficultyLevel?: number;
    isDefault?: boolean;
    answerEmotions?: string[];
    correctEmotion?: string;
  };
  game?: {
    targetEmotion?: string;
    timeLimitSeconds?: number;
    difficultyLevel?: number;
    isDefault?: boolean;
    unlockStarCost?: number;
    promptAssetType?: string | null;
    promptAssetUrl?: string | null;
  };
};

export async function updateAdminContent(input: UpdateAdminContentInput): Promise<ContentResult> {
  const adminId = normalizeAdminId(input.adminId);
  await requireActiveAdmin(adminId);

  const contentId = input.contentId?.trim();
  if (!contentId || !isValidUuid(contentId)) {
    throw new AppError("INVALID_CONTENT_ID", "Invalid content ID format.", 400);
  }

  const existing = await getAdminContentDetailRow(db, contentId);
  if (!existing) {
    throw new AppError("CONTENT_NOT_FOUND", "Content not found.", 404);
  }

  const baseData: any = {};
  if (input.title !== undefined) {
    const trimmedTitle = input.title.trim();
    if (!trimmedTitle) {
      throw new AppError("INVALID_TITLE", "Title cannot be empty.", 400);
    }
    baseData.title = trimmedTitle;
  }

  if (input.status !== undefined) {
    const status = input.status.trim().toUpperCase();
    if (!["DRAFT", "PUBLISHED"].includes(status)) {
      throw new AppError("INVALID_STATUS", "Status must be DRAFT or PUBLISHED.", 400);
    }
    baseData.status = status;
  }

  let typeData: any = {};

  if (existing.type === "LECTURE" && input.lecture) {
    if (input.lecture.mediaUrl !== undefined) {
      typeData.mediaUrl = input.lecture.mediaUrl.trim() || null;
    }
    if (input.lecture.description !== undefined) {
      typeData.description = input.lecture.description ? input.lecture.description.trim() : null;
    }
    if (input.lecture.difficultyLevel !== undefined) {
      const difficultyLevel = input.lecture.difficultyLevel;
      if (![1, 2, 3].includes(difficultyLevel)) {
        throw new AppError("INVALID_DIFFICULTY", "Difficulty level must be 1, 2, or 3.", 400);
      }
      typeData.difficultyLevel = difficultyLevel;
    }
    if (input.lecture.isDefault !== undefined) {
      typeData.isDefault = !!input.lecture.isDefault;
    }
  } else if (existing.type === "QUIZ" && input.quiz) {
    if (input.quiz.mediaUrl !== undefined) {
      typeData.mediaUrl = input.quiz.mediaUrl.trim() || null;
    }
    if (input.quiz.description !== undefined) {
      typeData.description = input.quiz.description ? input.quiz.description.trim() : null;
    }
    if (input.quiz.difficultyLevel !== undefined) {
      const difficultyLevel = input.quiz.difficultyLevel;
      if (![1, 2, 3].includes(difficultyLevel)) {
        throw new AppError("INVALID_DIFFICULTY", "Difficulty level must be 1, 2, or 3.", 400);
      }
      typeData.difficultyLevel = difficultyLevel;
    }
    if (input.quiz.isDefault !== undefined) {
      typeData.isDefault = !!input.quiz.isDefault;
    }

    const currentAnswerEmotions = input.quiz.answerEmotions ?? existing.quiz?.answerEmotions ?? [];
    const currentCorrectEmotion = input.quiz.correctEmotion?.trim() ?? existing.quiz?.correctEmotion;

    if (input.quiz.answerEmotions !== undefined) {
      if (!Array.isArray(input.quiz.answerEmotions) || input.quiz.answerEmotions.length === 0) {
        throw new AppError("INVALID_ANSWER_EMOTIONS", "Answer emotions must be a non-empty array.", 400);
      }
      typeData.answerEmotions = input.quiz.answerEmotions;
    }

    if (input.quiz.correctEmotion !== undefined) {
      if (!currentCorrectEmotion) {
        throw new AppError("INVALID_CORRECT_EMOTION", "Correct emotion cannot be empty.", 400);
      }
      typeData.correctEmotion = currentCorrectEmotion;
    }

    if (currentCorrectEmotion && !currentAnswerEmotions.includes(currentCorrectEmotion)) {
      throw new AppError("INVALID_CORRECT_EMOTION", "Correct emotion must be present in answer emotions.", 400);
    }
  } else if (existing.type === "GAME" && input.game) {
    if (input.game.targetEmotion !== undefined) {
      const targetEmotion = input.game.targetEmotion.trim();
      if (!targetEmotion) {
        throw new AppError("INVALID_TARGET_EMOTION", "Target emotion cannot be empty.", 400);
      }
      typeData.targetEmotion = targetEmotion;
    }
    if (input.game.timeLimitSeconds !== undefined) {
      const timeLimitSeconds = input.game.timeLimitSeconds;
      if (!Number.isInteger(timeLimitSeconds) || timeLimitSeconds <= 0) {
        throw new AppError("INVALID_TIME_LIMIT", "Time limit must be a positive integer.", 400);
      }
      typeData.timeLimitSeconds = timeLimitSeconds;
    }
    if (input.game.difficultyLevel !== undefined) {
      const difficultyLevel = input.game.difficultyLevel;
      if (![1, 2, 3].includes(difficultyLevel)) {
        throw new AppError("INVALID_DIFFICULTY", "Difficulty level must be 1, 2, or 3.", 400);
      }
      typeData.difficultyLevel = difficultyLevel;
    }
    if (input.game.isDefault !== undefined) {
      typeData.isDefault = !!input.game.isDefault;
    }
    if (input.game.unlockStarCost !== undefined) {
      const unlockStarCost = input.game.unlockStarCost;
      if (!Number.isInteger(unlockStarCost) || unlockStarCost < 0) {
        throw new AppError("INVALID_STAR_COST", "Unlock star cost must be a non-negative integer.", 400);
      }
      typeData.unlockStarCost = unlockStarCost;
    }
    if (input.game.promptAssetType !== undefined) {
      const promptAssetType = input.game.promptAssetType ? input.game.promptAssetType.trim().toUpperCase() : null;
      if (promptAssetType && !["ICON", "IMAGE", "VIDEO"].includes(promptAssetType)) {
        throw new AppError("INVALID_PROMPT_ASSET_TYPE", "Prompt asset type must be ICON, IMAGE, or VIDEO.", 400);
      }
      typeData.promptAssetType = promptAssetType;
    }
    if (input.game.promptAssetUrl !== undefined) {
      typeData.promptAssetUrl = input.game.promptAssetUrl ? input.game.promptAssetUrl.trim() : null;
    }
  }

  try {
    const row = await withTx(async (tx) => {
      return await updateAdminContentRow(tx, contentId, baseData, typeData);
    });

    if (!row) throw new Error("Failed to retrieve updated content detail.");

    return toContentResult(row as any);
  } catch (error: unknown) {
    if (error instanceof AppError) throw error;
    console.error("[ERROR] Unexpected error in updateAdminContent:", error);
    throw new AppError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
