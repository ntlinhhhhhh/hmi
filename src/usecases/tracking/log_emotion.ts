import { db } from "../../db/client.ts";
import { getChildProfileById } from "../../db/queries/child_profile_queries.ts";
import { logEmotionEvent } from "../../db/queries/tracking_queries.ts";
import {
  mapEmotionInputToAiLabel,
  mapEmotionInputToInternal,
  VALID_AI_EMOTION_LABELS,
  type ExternalAiEmotionLabel,
  type InternalEmotionValue,
} from "../../domain/ai_inference.ts";
import { isValidUuid } from "../../utils/validation.ts";
import { AppError } from "../app_error.ts";
import { getPgConstraintName, isPgErrorCode, PgErrorCode } from "../postgres_error.ts";

export type LogEmotionErrorType =
  | "MISSING_PARENT_ID"
  | "INVALID_PARENT_ID"
  | "MISSING_CHILD_ID"
  | "INVALID_CHILD_ID"
  | "CHILD_NOT_FOUND"
  | "CHILD_NOT_OWNED_BY_PARENT"
  | "MISSING_EMOTION_VALUE"
  | "INVALID_EMOTION_VALUE"
  | "EMOTION_AI_RESULT_MISMATCH"
  | "MISSING_TRIGGER_SOURCE"
  | "INVALID_TRIGGER_SOURCE"
  | "INVALID_DURATION"
  | "INVALID_CONFIDENCE_SCORE"
  | "INVALID_AI_RESULT"
  | "INVALID_AI_SCORES"
  | "INVALID_METADATA"
  | "INTERNAL_ERROR";

export type LogEmotionInput = {
  parentId: string;
  childId: string;
  emotionValue?: string;
  triggerSource: string;
  durationSeconds?: number;
  confidenceScore?: number;
  aiEmotionLabel?: string;
  aiConfidence?: number;
  aiScores?: unknown;
  aiResult?: unknown;
  metadata?: unknown;
};

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = Record<string, JsonValue>;

type AiResultInput = {
  emotion?: string;
  confidence?: number;
  allScores?: unknown;
};

export type AiEmotionScores = Partial<Record<ExternalAiEmotionLabel, number>>;

export type LogEmotionResult = {
  id: string;
  childId: string;
  emotionValue: string;
  triggerSource: string;
  durationSeconds: number | null;
  confidenceScore: number | null;
  aiEmotionLabel: string | null;
  aiConfidence: number | null;
  aiScores: AiEmotionScores | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

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

function normalizeEmotionValue(emotionValue: string | undefined): InternalEmotionValue {
  const value = emotionValue?.trim() ?? "";

  if (!value) {
    throw new AppError<LogEmotionErrorType>(
      "MISSING_EMOTION_VALUE",
      "Emotion value is required.",
      400,
    );
  }

  const normalizedValue = mapEmotionInputToInternal(value);
  if (!normalizedValue) {
    throw new AppError<LogEmotionErrorType>(
      "INVALID_EMOTION_VALUE",
      "Unsupported emotion value.",
      400,
    );
  }

  return normalizedValue;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeConfidenceScore(
  value: number | undefined,
  errorType: "INVALID_CONFIDENCE_SCORE" | "INVALID_AI_RESULT",
): number | undefined {
  if (value === undefined) return undefined;

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new AppError<LogEmotionErrorType>(
      errorType,
      "Confidence score must be a number from 0 to 1.",
      400,
    );
  }

  return value;
}

function normalizeAiResult(aiResult: unknown): AiResultInput | undefined {
  if (aiResult === undefined || aiResult === null) return undefined;

  if (!isRecord(aiResult)) {
    throw new AppError<LogEmotionErrorType>(
      "INVALID_AI_RESULT",
      "ai_result must be an object.",
      400,
    );
  }

  const result: AiResultInput = {};

  if ("emotion" in aiResult && aiResult.emotion !== undefined) {
    if (typeof aiResult.emotion !== "string") {
      throw new AppError<LogEmotionErrorType>(
        "INVALID_AI_RESULT",
        "ai_result.emotion must be a string.",
        400,
      );
    }

    result.emotion = aiResult.emotion;
  }

  if ("confidence" in aiResult && aiResult.confidence !== undefined) {
    if (typeof aiResult.confidence !== "number") {
      throw new AppError<LogEmotionErrorType>(
        "INVALID_AI_RESULT",
        "ai_result.confidence must be a number from 0 to 1.",
        400,
      );
    }

    result.confidence = normalizeConfidenceScore(aiResult.confidence, "INVALID_AI_RESULT");
  }

  if ("all_scores" in aiResult && aiResult.all_scores !== undefined) {
    result.allScores = aiResult.all_scores;
  } else if ("allScores" in aiResult && aiResult.allScores !== undefined) {
    result.allScores = aiResult.allScores;
  }

  return result;
}

function normalizeAiEmotionLabel(value: string | undefined): ExternalAiEmotionLabel | undefined {
  if (value === undefined || value.trim() === "") return undefined;

  const label = mapEmotionInputToAiLabel(value);
  if (!label) {
    throw new AppError<LogEmotionErrorType>(
      "INVALID_AI_RESULT",
      `AI emotion label must be one of: ${Array.from(VALID_AI_EMOTION_LABELS).join(", ")}.`,
      400,
    );
  }

  return label;
}

function normalizeAiScores(aiScores: unknown): AiEmotionScores | undefined {
  if (aiScores === undefined || aiScores === null) return undefined;

  if (!isRecord(aiScores)) {
    throw new AppError<LogEmotionErrorType>(
      "INVALID_AI_SCORES",
      "AI scores must be an object.",
      400,
    );
  }

  const normalizedScores: AiEmotionScores = {};

  for (const [rawLabel, rawScore] of Object.entries(aiScores)) {
    const label = mapEmotionInputToAiLabel(rawLabel);

    if (!label) {
      throw new AppError<LogEmotionErrorType>(
        "INVALID_AI_SCORES",
        `AI score labels must be one of: ${Array.from(VALID_AI_EMOTION_LABELS).join(", ")}.`,
        400,
      );
    }

    if (
      typeof rawScore !== "number" ||
      !Number.isFinite(rawScore) ||
      rawScore < 0 ||
      rawScore > 1
    ) {
      throw new AppError<LogEmotionErrorType>(
        "INVALID_AI_SCORES",
        "AI score values must be numbers from 0 to 1.",
        400,
      );
    }

    normalizedScores[label] = rawScore;
  }

  return normalizedScores;
}

function isJsonValue(value: unknown, depth: number = 0): value is JsonValue {
  if (depth > 8) return false;
  if (value === null) return true;

  const valueType = typeof value;
  if (valueType === "string" || valueType === "boolean") return true;
  if (valueType === "number") return Number.isFinite(value);

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item, depth + 1));
  }

  if (isRecord(value)) {
    return Object.entries(value).every(
      ([key, item]) => key.length > 0 && key.length <= 120 && isJsonValue(item, depth + 1),
    );
  }

  return false;
}

function normalizeMetadata(metadata: unknown): JsonRecord | undefined {
  if (metadata === undefined || metadata === null) return undefined;

  if (!isRecord(metadata) || !isJsonValue(metadata)) {
    throw new AppError<LogEmotionErrorType>(
      "INVALID_METADATA",
      "metadata must be a JSON object.",
      400,
    );
  }

  const encodedMetadata = JSON.stringify(metadata);
  if (encodedMetadata.length > 16_384) {
    throw new AppError<LogEmotionErrorType>(
      "INVALID_METADATA",
      "metadata must be 16 KB or smaller.",
      400,
    );
  }

  return metadata as JsonRecord;
}

export async function recordEmotionLog(input: LogEmotionInput): Promise<LogEmotionResult> {
  const parentId = normalizeParentId(input.parentId);
  const childId = normalizeChildId(input.childId);
  const triggerSource = normalizeTriggerSource(input.triggerSource);
  const durationSeconds = normalizeDuration(input.durationSeconds);
  const aiResult = normalizeAiResult(input.aiResult);
  const emotionValue = normalizeEmotionValue(input.emotionValue ?? aiResult?.emotion);
  const aiResultEmotionValue = aiResult?.emotion
    ? normalizeEmotionValue(aiResult.emotion)
    : undefined;

  if (aiResultEmotionValue !== undefined && input.emotionValue !== undefined) {
    const explicitEmotionValue = normalizeEmotionValue(input.emotionValue);

    if (explicitEmotionValue !== aiResultEmotionValue) {
      throw new AppError<LogEmotionErrorType>(
        "EMOTION_AI_RESULT_MISMATCH",
        "emotion_value and ai_result.emotion must describe the same emotion.",
        400,
      );
    }
  }

  const aiEmotionLabel = normalizeAiEmotionLabel(input.aiEmotionLabel ?? aiResult?.emotion);
  const aiConfidence = normalizeConfidenceScore(
    input.aiConfidence ?? aiResult?.confidence,
    "INVALID_CONFIDENCE_SCORE",
  );
  const confidenceScore = normalizeConfidenceScore(
    input.confidenceScore ?? aiConfidence,
    "INVALID_CONFIDENCE_SCORE",
  );
  const aiScores = normalizeAiScores(input.aiScores ?? aiResult?.allScores);
  const metadata = normalizeMetadata(input.metadata);

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
      confidenceScore,
      aiEmotionLabel,
      aiConfidence,
      aiScores,
      metadata,
    });

    return {
      id: log.id,
      childId: log.childId,
      emotionValue: log.emotionValue,
      triggerSource: log.triggerSource,
      durationSeconds: log.durationSeconds ?? null,
      confidenceScore: log.confidenceScore ?? null,
      aiEmotionLabel: log.aiEmotionLabel ?? null,
      aiConfidence: log.aiConfidence ?? null,
      aiScores: log.aiScores ?? null,
      metadata: log.metadata ?? null,
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
      const constraint = getPgConstraintName(error);
      if (constraint === "emotion_logs_duration_check") {
        throw new AppError<LogEmotionErrorType>(
          "INVALID_DURATION",
          "Duration must be a positive integer number of seconds.",
          400,
        );
      }

      if (
        constraint === "emotion_logs_confidence_score_check" ||
        constraint === "emotion_logs_ai_confidence_check"
      ) {
        throw new AppError<LogEmotionErrorType>(
          "INVALID_CONFIDENCE_SCORE",
          "Confidence score must be a number from 0 to 1.",
          400,
        );
      }

      if (constraint === "emotion_logs_ai_scores_object_check") {
        throw new AppError<LogEmotionErrorType>(
          "INVALID_AI_SCORES",
          "AI scores must be an object.",
          400,
        );
      }

      if (constraint === "emotion_logs_metadata_object_check") {
        throw new AppError<LogEmotionErrorType>(
          "INVALID_METADATA",
          "metadata must be a JSON object.",
          400,
        );
      }
    }

    console.error("[ERROR] Unexpected error in use case: Log emotion", error);
    throw new AppError<LogEmotionErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
