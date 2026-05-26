import { db } from "../../db/client.ts";
import {
  createRegulationEvent,
  getChildEmotionLogById,
} from "../../db/queries/regulation_queries.ts";
import { AppError } from "../app_error.ts";
import { normalizeJsonMetadata } from "../json_metadata.ts";
import {
  normalizeUseCaseUuid,
  requireOwnedActiveParentChild,
  type ParentChildAccessErrorType,
} from "../parent_child_access.ts";
import { getPgConstraintName, isPgErrorCode, PgErrorCode } from "../postgres_error.ts";
import {
  normalizeEmotionLogId,
  normalizeRegulationActionInput,
  toRegulationEventResult,
  type RegulationEventResult,
} from "./regulation_models.ts";

export type CreateRegulationEventErrorType =
  | ParentChildAccessErrorType
  | "MISSING_TRIGGER_EMOTION_LOG_ID"
  | "INVALID_TRIGGER_EMOTION_LOG_ID"
  | "TRIGGER_EMOTION_LOG_NOT_FOUND"
  | "MISSING_ACTION"
  | "INVALID_ACTION"
  | "MISSING_STARTED_AT"
  | "INVALID_STARTED_AT"
  | "INVALID_ENDED_AT"
  | "INVALID_DURATION"
  | "INVALID_METADATA"
  | "INTERNAL_ERROR";

export type CreateRegulationEventInput = {
  parentId: string;
  childId: string;
  triggerEmotionLogId?: string;
  action?: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  metadata?: unknown;
};

function normalizeRequiredDate(
  value: string | undefined,
  missingType: "MISSING_STARTED_AT",
  invalidType: "INVALID_STARTED_AT",
): string {
  const rawValue = value?.trim() ?? "";
  if (!rawValue) {
    throw new AppError<CreateRegulationEventErrorType>(missingType, "started_at is required.", 400);
  }

  const parsedDate = new Date(rawValue);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError<CreateRegulationEventErrorType>(
      invalidType,
      "started_at must be a valid ISO date.",
      400,
    );
  }

  return parsedDate.toISOString();
}

function normalizeOptionalDate(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === "") return undefined;

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError<CreateRegulationEventErrorType>(
      "INVALID_ENDED_AT",
      "ended_at must be a valid ISO date.",
      400,
    );
  }

  return parsedDate.toISOString();
}

function normalizeDuration(durationSeconds: number | undefined): number | undefined {
  if (durationSeconds === undefined) return undefined;

  if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
    throw new AppError<CreateRegulationEventErrorType>(
      "INVALID_DURATION",
      "duration_seconds must be a positive integer.",
      400,
    );
  }

  return durationSeconds;
}

export async function createChildRegulationEvent(
  input: CreateRegulationEventInput,
): Promise<RegulationEventResult> {
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
  const triggerEmotionLogId = normalizeEmotionLogId(
    input.triggerEmotionLogId,
    "MISSING_TRIGGER_EMOTION_LOG_ID",
    "INVALID_TRIGGER_EMOTION_LOG_ID",
  );
  const action = normalizeRegulationActionInput(input.action, "MISSING_ACTION", "INVALID_ACTION");
  const startedAt = normalizeRequiredDate(
    input.startedAt,
    "MISSING_STARTED_AT",
    "INVALID_STARTED_AT",
  );
  const endedAt = normalizeOptionalDate(input.endedAt);
  const durationSeconds = normalizeDuration(input.durationSeconds);
  const metadata = normalizeJsonMetadata(input.metadata, "INVALID_METADATA");

  if (endedAt !== undefined && endedAt < startedAt) {
    throw new AppError<CreateRegulationEventErrorType>(
      "INVALID_ENDED_AT",
      "ended_at must be later than or equal to started_at.",
      400,
    );
  }

  try {
    await requireOwnedActiveParentChild({ parentId, childId });

    const triggerLog = await getChildEmotionLogById(db, childId, triggerEmotionLogId);
    if (!triggerLog) {
      throw new AppError<CreateRegulationEventErrorType>(
        "TRIGGER_EMOTION_LOG_NOT_FOUND",
        "Trigger emotion log not found for this child.",
        404,
      );
    }

    const event = await createRegulationEvent(db, {
      childId,
      triggerEmotionLogId,
      action,
      startedAt,
      endedAt,
      durationSeconds,
      metadata,
    });

    return toRegulationEventResult(event);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    if (isPgErrorCode(error, PgErrorCode.CHECK_VIOLATION)) {
      const constraint = getPgConstraintName(error);

      if (constraint === "regulation_events_duration_check") {
        throw new AppError<CreateRegulationEventErrorType>(
          "INVALID_DURATION",
          "duration_seconds must be a positive integer.",
          400,
        );
      }

      if (constraint === "regulation_events_time_check") {
        throw new AppError<CreateRegulationEventErrorType>(
          "INVALID_ENDED_AT",
          "ended_at must be later than or equal to started_at.",
          400,
        );
      }

      if (constraint === "regulation_events_metadata_object_check") {
        throw new AppError<CreateRegulationEventErrorType>(
          "INVALID_METADATA",
          "metadata must be a JSON object.",
          400,
        );
      }
    }

    console.error("[ERROR] Unexpected error in use case: Create regulation event", error);
    throw new AppError<CreateRegulationEventErrorType>(
      "INTERNAL_ERROR",
      "Internal server error.",
      500,
    );
  }
}
