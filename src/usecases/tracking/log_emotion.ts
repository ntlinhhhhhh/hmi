import { db } from "../../db/client.ts";
import { getChildProfileById } from "../../db/queries/child_profile_queries.ts";
import { logEmotionEvent } from "../../db/queries/tracking_queries.ts";
import { isValidUuid } from "../../utils/validation.ts";
import { AppError } from "../app_error.ts";
import { isPgErrorCode, PgErrorCode } from "../postgres_error.ts";

export type LogEmotionErrorType =
  | "MISSING_PARENT_ID"
  | "INVALID_PARENT_ID"
  | "MISSING_CHILD_ID"
  | "INVALID_CHILD_ID"
  | "CHILD_NOT_FOUND"
  | "CHILD_NOT_OWNED_BY_PARENT"
  | "MISSING_EMOTION_VALUE"
  | "INVALID_EMOTION_VALUE"
  | "MISSING_TRIGGER_SOURCE"
  | "INVALID_TRIGGER_SOURCE"
  | "INVALID_DURATION"
  | "INTERNAL_ERROR";

export type LogEmotionInput = {
  parentId: string;
  childId: string;
  emotionValue: string;
  triggerSource: string;
  durationSeconds?: number;
};

export type LogEmotionResult = {
  id: string;
  childId: string;
  emotionValue: string;
  triggerSource: string;
  durationSeconds: number | null;
  createdAt: string;
};

export const VALID_EMOTIONS = new Set([
  "HAPPY",
  "SAD",
  "ANGRY",
  "STRESSED",
  "CALM",
  "NEUTRAL",
  "SCARED",
  "SURPRISED",
]);

export const VALID_TRIGGER_SOURCES = new Set([
  "AAC_BOARD",
  "GAME",
  "QUIZ",
  "LECTURE",
  "WEBCAM",
  "SYSTEM",
]);

function normalizeParentId(parentId: string): string {
  const value = parentId.trim();

  if (!value) {
    throw new AppError<LogEmotionErrorType>("MISSING_PARENT_ID", "Parent ID is required.", 400);
  }

  if (!isValidUuid(value)) {
    throw new AppError<LogEmotionErrorType>("INVALID_PARENT_ID", "Invalid parent ID format.", 400);
  }

  return value;
}

function normalizeChildId(childId: string): string {
  const value = childId.trim();

  if (!value) {
    throw new AppError<LogEmotionErrorType>("MISSING_CHILD_ID", "Child ID is required.", 400);
  }

  if (!isValidUuid(value)) {
    throw new AppError<LogEmotionErrorType>("INVALID_CHILD_ID", "Invalid child ID format.", 400);
  }

  return value;
}

function normalizeEmotionValue(emotionValue: string): string {
  const value = emotionValue.trim().toUpperCase();

  if (!value) {
    throw new AppError<LogEmotionErrorType>(
      "MISSING_EMOTION_VALUE",
      "Emotion value is required.",
      400,
    );
  }

  if (!VALID_EMOTIONS.has(value)) {
    throw new AppError<LogEmotionErrorType>(
      "INVALID_EMOTION_VALUE",
      "Unsupported emotion value.",
      400,
    );
  }

  return value;
}

function normalizeTriggerSource(triggerSource: string): string {
  const value = triggerSource.trim().toUpperCase();

  if (!value) {
    throw new AppError<LogEmotionErrorType>(
      "MISSING_TRIGGER_SOURCE",
      "Trigger source is required.",
      400,
    );
  }

  if (!VALID_TRIGGER_SOURCES.has(value)) {
    throw new AppError<LogEmotionErrorType>(
      "INVALID_TRIGGER_SOURCE",
      "Unsupported trigger source.",
      400,
    );
  }

  return value;
}

function normalizeDuration(durationSeconds: number | undefined): number | undefined {
  if (durationSeconds === undefined) return undefined;

  if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
    throw new AppError<LogEmotionErrorType>(
      "INVALID_DURATION",
      "Duration must be a positive integer number of seconds.",
      400,
    );
  }

  return durationSeconds;
}

export async function recordEmotionLog(input: LogEmotionInput): Promise<LogEmotionResult> {
  const parentId = normalizeParentId(input.parentId);
  const childId = normalizeChildId(input.childId);
  const emotionValue = normalizeEmotionValue(input.emotionValue);
  const triggerSource = normalizeTriggerSource(input.triggerSource);
  const durationSeconds = normalizeDuration(input.durationSeconds);

  try {
    const child = await getChildProfileById(db, childId);

    if (!child) {
      throw new AppError<LogEmotionErrorType>("CHILD_NOT_FOUND", "Child profile not found.", 404);
    }

    if (child.parentId !== parentId) {
      throw new AppError<LogEmotionErrorType>(
        "CHILD_NOT_OWNED_BY_PARENT",
        "Child profile does not belong to this parent.",
        403,
      );
    }

    const log = await logEmotionEvent(db, {
      childId,
      emotionValue,
      triggerSource,
      durationSeconds,
    });

    return {
      id: log.id,
      childId: log.childId,
      emotionValue: log.emotionValue,
      triggerSource: log.triggerSource,
      durationSeconds: log.durationSeconds ?? null,
      createdAt: log.createdAt,
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    if (isPgErrorCode(error, PgErrorCode.FOREIGN_KEY_VIOLATION)) {
      throw new AppError<LogEmotionErrorType>("CHILD_NOT_FOUND", "Child profile not found.", 404);
    }

    if (isPgErrorCode(error, PgErrorCode.CHECK_VIOLATION)) {
      throw new AppError<LogEmotionErrorType>(
        "INVALID_DURATION",
        "Duration must be a positive integer number of seconds.",
        400,
      );
    }

    console.error("[ERROR] Unexpected error in use case: Log emotion", error);
    throw new AppError<LogEmotionErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
