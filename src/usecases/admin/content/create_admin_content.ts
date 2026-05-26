import { withTx } from "../../../db/client.ts";
import { createAdminContentRow } from "../../../db/queries/admin_content_queries.ts";
import { AppError } from "../../app_error.ts";
import { normalizeAdminId, requireActiveAdmin } from "../admin_authorization.ts";
import { toContentResult, type ContentResult } from "../../content/content_models.ts";

export type CreateAdminContentInput = {
  adminId: string;
  title: string;
  type: string;
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
    answerEmotions: string[];
    correctEmotion: string;
  };
  game?: {
    targetEmotion: string;
    timeLimitSeconds: number;
    difficultyLevel?: number;
    isDefault?: boolean;
    unlockStarCost?: number;
    promptAssetType?: string | null;
    promptAssetUrl?: string | null;
  };
};

export async function createAdminContent(input: CreateAdminContentInput): Promise<ContentResult> {
  const adminId = normalizeAdminId(input.adminId);
  await requireActiveAdmin(adminId);

  const title = input.title?.trim();
  if (!title) {
    throw new AppError("INVALID_TITLE", "Title is required.", 400);
  }

  const type = input.type?.trim().toUpperCase();
  if (!["LECTURE", "QUIZ", "GAME"].includes(type)) {
    throw new AppError("INVALID_TYPE", "Type must be LECTURE, QUIZ, or GAME.", 400);
  }

  const status = input.status?.trim().toUpperCase() || "DRAFT";
  if (!["DRAFT", "PUBLISHED"].includes(status)) {
    throw new AppError("INVALID_STATUS", "Status must be DRAFT or PUBLISHED.", 400);
  }

  let typeData: any = {};

  if (type === "LECTURE") {
    if (!input.lecture) {
      throw new AppError("MISSING_LECTURE_PAYLOAD", "Lecture payload is required.", 400);
    }
    const difficultyLevel = input.lecture.difficultyLevel ?? 1;
    if (![1, 2, 3].includes(difficultyLevel)) {
      throw new AppError("INVALID_DIFFICULTY", "Difficulty level must be 1, 2, or 3.", 400);
    }

    typeData = {
      mediaUrl: input.lecture.mediaUrl?.trim() || null,
      description: input.lecture.description?.trim() || null,
      difficultyLevel,
      isDefault: !!input.lecture.isDefault,
    };
  } else if (type === "QUIZ") {
    if (!input.quiz) {
      throw new AppError("MISSING_QUIZ_PAYLOAD", "Quiz payload is required.", 400);
    }
    const difficultyLevel = input.quiz.difficultyLevel ?? 1;
    if (![1, 2, 3].includes(difficultyLevel)) {
      throw new AppError("INVALID_DIFFICULTY", "Difficulty level must be 1, 2, or 3.", 400);
    }
    const answerEmotions = input.quiz.answerEmotions || [];
    if (!Array.isArray(answerEmotions) || answerEmotions.length === 0) {
      throw new AppError("INVALID_ANSWER_EMOTIONS", "Answer emotions must be a non-empty array.", 400);
    }
    const correctEmotion = input.quiz.correctEmotion?.trim();
    if (!correctEmotion || !answerEmotions.includes(correctEmotion)) {
      throw new AppError("INVALID_CORRECT_EMOTION", "Correct emotion must be present in answer emotions.", 400);
    }

    typeData = {
      mediaUrl: input.quiz.mediaUrl?.trim() || null,
      description: input.quiz.description?.trim() || null,
      difficultyLevel,
      isDefault: !!input.quiz.isDefault,
      answerEmotions,
      correctEmotion,
    };
  } else if (type === "GAME") {
    if (!input.game) {
      throw new AppError("MISSING_GAME_PAYLOAD", "Game payload is required.", 400);
    }
    const targetEmotion = input.game.targetEmotion?.trim();
    if (!targetEmotion) {
      throw new AppError("INVALID_TARGET_EMOTION", "Target emotion is required.", 400);
    }
    const timeLimitSeconds = input.game.timeLimitSeconds;
    if (!Number.isInteger(timeLimitSeconds) || timeLimitSeconds <= 0) {
      throw new AppError("INVALID_TIME_LIMIT", "Time limit must be a positive integer.", 400);
    }
    const difficultyLevel = input.game.difficultyLevel ?? 1;
    if (![1, 2, 3].includes(difficultyLevel)) {
      throw new AppError("INVALID_DIFFICULTY", "Difficulty level must be 1, 2, or 3.", 400);
    }
    const unlockStarCost = input.game.unlockStarCost ?? 0;
    if (!Number.isInteger(unlockStarCost) || unlockStarCost < 0) {
      throw new AppError("INVALID_STAR_COST", "Unlock star cost must be a non-negative integer.", 400);
    }
    const promptAssetType = input.game.promptAssetType?.trim().toUpperCase() || null;
    if (promptAssetType && !["ICON", "IMAGE", "VIDEO"].includes(promptAssetType)) {
      throw new AppError("INVALID_PROMPT_ASSET_TYPE", "Prompt asset type must be ICON, IMAGE, or VIDEO.", 400);
    }

    typeData = {
      targetEmotion,
      timeLimitSeconds,
      difficultyLevel,
      isDefault: !!input.game.isDefault,
      unlockStarCost,
      promptAssetType,
      promptAssetUrl: input.game.promptAssetUrl?.trim() || null,
    };
  }

  try {
    const row = await withTx(async (tx) => {
      return await createAdminContentRow(
        tx,
        {
          title,
          type,
          status,
          createdBy: adminId,
        },
        typeData,
      );
    });

    if (!row) throw new Error("Failed to retrieve created content detail.");

    return toContentResult(row as any);
  } catch (error: unknown) {
    if (error instanceof AppError) throw error;
    console.error("[ERROR] Unexpected error in createAdminContent:", error);
    throw new AppError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
