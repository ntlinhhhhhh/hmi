import { sql } from "drizzle-orm";
import { db, withTx } from "../../db/client.ts";
import {
  findPublishedContentDetailById,
  finishContentSessionTx,
  getChildContentUnlockByContentId,
  getContentSessionByChildIdempotencyKey,
} from "../../db/queries/learning_queries.ts";
import { getChildProfileById } from "../../db/queries/child_profile_queries.ts";
import { getContentRewardStars } from "../../domain/reward_policy.ts";
import { isGameSessionSuccessful } from "../../domain/game_policy.ts";
import { isValidUuid } from "../../utils/validation.ts";
import { AppError } from "../app_error.ts";
import { normalizeJsonMetadata } from "../json_metadata.ts";
import {
  normalizeUseCaseUuid,
  requireOwnedActiveParentChild,
  type ParentChildAccessErrorType,
} from "../parent_child_access.ts";
import { getPgConstraintName, isPgErrorCode, PgErrorCode } from "../postgres_error.ts";

export type RecordContentSessionErrorType =
  | ParentChildAccessErrorType
  | "MISSING_CONTENT_ID"
  | "INVALID_CONTENT_ID"
  | "CONTENT_NOT_FOUND"
  | "CONTENT_TYPE_NOT_SUPPORTED"
  | "CONTENT_LOCKED"
  | "INVALID_STATUS"
  | "INVALID_DURATION"
  | "INVALID_IDEMPOTENCY_KEY"
  | "IDEMPOTENCY_KEY_CONFLICT"
  | "INVALID_STARTED_AT"
  | "INVALID_COMPLETED_AT"
  | "INVALID_METADATA"
  | "INVALID_EMOTION"
  | "INTERNAL_ERROR";

export type RecordContentSessionInput = {
  parentId: string;
  childId: string;
  contentId?: string;
  idempotencyKey?: string;
  durationSeconds?: number;
  status?: string;
  startedAt?: string;
  completedAt?: string;
  metadata?: unknown;
  // Quiz/Game outcome fields
  isCorrect?: boolean;
  selectedEmotion?: string;
  aiMatchScore?: number;
  aiDetectedEmotion?: string;
  aiConfidence?: number;
  aiScores?: unknown;
};

export type ContentSessionResult = {
  id: string;
  childId: string;
  contentId: string;
  unlockContentId: string;
  durationSeconds: number | null;
  isCorrect: boolean | null;
  starsEarned: number;
  status: "COMPLETED" | "ABANDONED";
  idempotencyKey: string | null;
  startedAt: string | null;
  completedAt: string | null;
  aiMatchScore: number | null;
  selectedEmotion: string | null;
  aiDetectedEmotion: string | null;
  aiConfidence: number | null;
  aiScores: Record<string, number> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type RecordContentSessionResult = {
  session: ContentSessionResult;
  childTotalStars: number;
};

type SessionRow = {
  id: string;
  childId: string;
  unlockContentId: string;
  durationSeconds: number | null;
  isCorrect: boolean | null;
  starsEarned: number;
  status: string;
  idempotencyKey: string | null;
  startedAt: string | null;
  completedAt: string | null;
  aiMatchScore: number | null;
  selectedEmotion: string | null;
  aiDetectedEmotion: string | null;
  aiConfidence: number | null;
  aiScores: Record<string, number> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  unlockContent?: {
    contentId: string;
  };
};

function normalizeContentId(contentId: string | undefined): string {
  const value = contentId?.trim() ?? "";

  if (!value) {
    throw new AppError<RecordContentSessionErrorType>(
      "MISSING_CONTENT_ID",
      "content_id is required.",
      400,
    );
  }

  if (!isValidUuid(value)) {
    throw new AppError<RecordContentSessionErrorType>(
      "INVALID_CONTENT_ID",
      "Invalid content ID format.",
      400,
    );
  }

  return value;
}

function normalizeStatus(status: string | undefined): "COMPLETED" | "ABANDONED" {
  if (status === undefined || status.trim() === "") return "COMPLETED";

  const value = status.trim().toUpperCase();
  if (value !== "COMPLETED" && value !== "ABANDONED") {
    throw new AppError<RecordContentSessionErrorType>(
      "INVALID_STATUS",
      "status must be COMPLETED or ABANDONED.",
      400,
    );
  }

  return value;
}

function normalizeDuration(durationSeconds: number | undefined): number | undefined {
  if (durationSeconds === undefined) return undefined;

  if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
    throw new AppError<RecordContentSessionErrorType>(
      "INVALID_DURATION",
      "duration_seconds must be a positive integer.",
      400,
    );
  }

  return durationSeconds;
}

function normalizeIdempotencyKey(idempotencyKey: string | undefined): string | undefined {
  if (idempotencyKey === undefined || idempotencyKey.trim() === "") return undefined;

  const value = idempotencyKey.trim();
  if (value.length > 120 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new AppError<RecordContentSessionErrorType>(
      "INVALID_IDEMPOTENCY_KEY",
      "idempotency_key must be 120 characters or fewer and cannot contain control characters.",
      400,
    );
  }

  return value;
}

function normalizeOptionalDate(
  value: string | undefined,
  errorType: "INVALID_STARTED_AT" | "INVALID_COMPLETED_AT",
): string | undefined {
  if (value === undefined || value.trim() === "") return undefined;

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError<RecordContentSessionErrorType>(
      errorType,
      "Date fields must be valid ISO dates.",
      400,
    );
  }

  return parsedDate.toISOString();
}

function toSessionResult(row: SessionRow, contentId: string): ContentSessionResult {
  const status = row.status === "ABANDONED" ? "ABANDONED" : "COMPLETED";

  return {
    id: row.id,
    childId: row.childId,
    contentId,
    unlockContentId: row.unlockContentId,
    durationSeconds: row.durationSeconds ?? null,
    isCorrect: row.isCorrect ?? null,
    starsEarned: row.starsEarned,
    status,
    idempotencyKey: row.idempotencyKey ?? null,
    startedAt: row.startedAt ?? null,
    completedAt: row.completedAt ?? null,
    aiMatchScore: row.aiMatchScore ?? null,
    selectedEmotion: row.selectedEmotion ?? null,
    aiDetectedEmotion: row.aiDetectedEmotion ?? null,
    aiConfidence: row.aiConfidence ?? null,
    aiScores: row.aiScores ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt,
  };
}

async function getChildTotalStars(childId: string): Promise<number> {
  const child = await getChildProfileById(db, childId);
  if (!child) {
    throw new AppError<RecordContentSessionErrorType>(
      "CHILD_NOT_FOUND",
      "Child profile not found.",
      404,
    );
  }

  return child.totalStars;
}

export async function recordContentSession(
  input: RecordContentSessionInput,
): Promise<RecordContentSessionResult> {
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
  const contentId = normalizeContentId(input.contentId);
  const status = normalizeStatus(input.status);
  const durationSeconds = normalizeDuration(input.durationSeconds);
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  const startedAt = normalizeOptionalDate(input.startedAt, "INVALID_STARTED_AT");
  const completedAt = normalizeOptionalDate(input.completedAt, "INVALID_COMPLETED_AT");
  const metadata = normalizeJsonMetadata(input.metadata, "INVALID_METADATA");
  const aiScores = normalizeJsonMetadata(input.aiScores, "INVALID_METADATA") as Record<string, number> | null;

  if (startedAt !== undefined && completedAt !== undefined && completedAt < startedAt) {
    throw new AppError<RecordContentSessionErrorType>(
      "INVALID_COMPLETED_AT",
      "completed_at must be later than or equal to started_at.",
      400,
    );
  }

  try {
    await requireOwnedActiveParentChild({ parentId, childId });

    const content = await findPublishedContentDetailById(db, contentId);
    if (!content) {
      throw new AppError<RecordContentSessionErrorType>(
        "CONTENT_NOT_FOUND",
        "Published content not found.",
        404,
      );
    }

    const unlock = await getChildContentUnlockByContentId(db, childId, contentId);
    if (!unlock) {
      throw new AppError<RecordContentSessionErrorType>(
        "CONTENT_LOCKED",
        "Content is not unlocked for this child.",
        403,
      );
    }

    let calculatedIsCorrect: boolean | null = null;
    let rewardStars = 0;

    if (content.type === "LECTURE") {
      rewardStars = status === "COMPLETED" ? getContentRewardStars("LECTURE_COMPLETION") : 0;
    } else if (content.type === "QUIZ") {
      if (!content.quiz) throw new Error("Quiz content structure missing.");
      const selectedEmotion = input.selectedEmotion?.trim().toUpperCase();
      let isCorrect = input.isCorrect;

      if (selectedEmotion) {
        isCorrect = selectedEmotion === content.quiz.correctEmotion.trim().toUpperCase();
      }

      if (isCorrect !== undefined) {
        calculatedIsCorrect = isCorrect;
        if (status === "COMPLETED" && isCorrect === true) {
          rewardStars = getContentRewardStars("QUIZ_CORRECT");
        }
      }
    } else if (content.type === "GAME") {
      if (!content.game) throw new Error("Game content structure missing.");
      
      const gameSuccess = isGameSessionSuccessful(content.game.targetEmotion, {
        isCorrect: input.isCorrect,
        aiMatchScore: input.aiMatchScore,
        aiDetectedEmotion: input.aiDetectedEmotion,
        aiConfidence: input.aiConfidence,
      });

      calculatedIsCorrect = gameSuccess;
      if (status === "COMPLETED" && gameSuccess) {
        rewardStars = getContentRewardStars("AI_GAME_SUCCESS");
      }
    } else {
      throw new AppError<RecordContentSessionErrorType>(
        "CONTENT_TYPE_NOT_SUPPORTED",
        "Unsupported content type.",
        400,
      );
    }

    const session = await withTx(async (tx) => {
      if (idempotencyKey !== undefined) {
        const idempotencyLockKey = `content-session-idempotency:${childId}:${idempotencyKey}`;
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${idempotencyLockKey}))`);

        const existingSession = await getContentSessionByChildIdempotencyKey(
          tx,
          childId,
          idempotencyKey,
        );

        if (existingSession) {
          if (existingSession.unlockContent.contentId !== contentId) {
            throw new AppError<RecordContentSessionErrorType>(
              "IDEMPOTENCY_KEY_CONFLICT",
              "idempotency_key was already used for a different content session.",
              409,
            );
          }

          return existingSession;
        }
      }

      return await finishContentSessionTx(
        tx,
        {
          childId,
          unlockContentId: unlock.id,
          durationSeconds,
          isCorrect: calculatedIsCorrect,
          aiMatchScore: input.aiMatchScore ?? null,
          selectedEmotion: input.selectedEmotion?.trim().toUpperCase() || null,
          idempotencyKey,
          startedAt,
          completedAt,
          aiDetectedEmotion: input.aiDetectedEmotion?.trim().toUpperCase() || null,
          aiConfidence: input.aiConfidence ?? null,
          aiScores,
          metadata,
          status,
        },
        rewardStars,
      );
    });

    return {
      session: toSessionResult(session as any, contentId),
      childTotalStars: await getChildTotalStars(childId),
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    if (isPgErrorCode(error, PgErrorCode.UNIQUE_VIOLATION)) {
      const constraint = getPgConstraintName(error);
      if (constraint === "content_sessions_child_idempotency_key_idx") {
        throw new AppError<RecordContentSessionErrorType>(
          "IDEMPOTENCY_KEY_CONFLICT",
          "idempotency_key was already used for a different content session.",
          409,
        );
      }
    }

    if (isPgErrorCode(error, PgErrorCode.CHECK_VIOLATION)) {
      const constraint = getPgConstraintName(error);

      if (constraint === "content_sessions_status_check") {
        throw new AppError<RecordContentSessionErrorType>(
          "INVALID_STATUS",
          "status must be COMPLETED or ABANDONED.",
          400,
        );
      }

      if (constraint === "content_sessions_duration_check") {
        throw new AppError<RecordContentSessionErrorType>(
          "INVALID_DURATION",
          "duration_seconds must be a positive integer.",
          400,
        );
      }

      if (constraint === "content_sessions_time_check") {
        throw new AppError<RecordContentSessionErrorType>(
          "INVALID_COMPLETED_AT",
          "completed_at must be later than or equal to started_at.",
          400,
        );
      }

      if (constraint === "content_sessions_metadata_object_check") {
        throw new AppError<RecordContentSessionErrorType>(
          "INVALID_METADATA",
          "metadata must be a JSON object.",
          400,
        );
      }
    }

    console.error("[ERROR] Unexpected error in use case: Record content session", error);
    throw new AppError<RecordContentSessionErrorType>(
      "INTERNAL_ERROR",
      "Internal server error.",
      500,
    );
  }
}
