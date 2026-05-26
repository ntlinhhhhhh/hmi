import {
  normalizeRegulationAction,
  VALID_REGULATION_ACTIONS,
  type RegulationAction,
} from "../../domain/regulation_policy.ts";
import { isValidUuid } from "../../utils/validation.ts";
import { AppError } from "../app_error.ts";

export type RegulationEventResult = {
  id: string;
  childId: string;
  triggerEmotionLogId: string;
  action: RegulationAction;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export function normalizeEmotionLogId<TError extends string>(
  emotionLogId: string | undefined,
  missingType: TError,
  invalidType: TError,
): string {
  const value = emotionLogId?.trim() ?? "";

  if (!value) {
    throw new AppError<TError>(missingType, "trigger_emotion_log_id is required.", 400);
  }

  if (!isValidUuid(value)) {
    throw new AppError<TError>(invalidType, "Invalid trigger_emotion_log_id format.", 400);
  }

  return value;
}

export function normalizeRegulationActionInput<TError extends string>(
  action: string | undefined,
  missingType: TError,
  invalidType: TError,
): RegulationAction {
  const value = action?.trim() ?? "";

  if (!value) {
    throw new AppError<TError>(missingType, "Regulation action is required.", 400);
  }

  const normalizedAction = normalizeRegulationAction(value);
  if (!normalizedAction) {
    throw new AppError<TError>(
      invalidType,
      `Regulation action must be one of: ${Array.from(VALID_REGULATION_ACTIONS).join(", ")}.`,
      400,
    );
  }

  return normalizedAction;
}

export function normalizeOptionalRegulationAction<TError extends string>(
  action: string | undefined,
  invalidType: TError,
): RegulationAction | undefined {
  if (action === undefined || action.trim() === "") return undefined;

  const normalizedAction = normalizeRegulationAction(action);
  if (!normalizedAction) {
    throw new AppError<TError>(
      invalidType,
      `Regulation action must be one of: ${Array.from(VALID_REGULATION_ACTIONS).join(", ")}.`,
      400,
    );
  }

  return normalizedAction;
}

export function toRegulationEventResult(row: {
  id: string;
  childId: string;
  triggerEmotionLogId: string;
  action: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}): RegulationEventResult {
  const action = normalizeRegulationAction(row.action);
  if (!action) {
    throw new Error(`[ERROR] Invalid regulation action stored in database: ${row.action}.`);
  }

  return {
    id: row.id,
    childId: row.childId,
    triggerEmotionLogId: row.triggerEmotionLogId,
    action,
    startedAt: row.startedAt,
    endedAt: row.endedAt ?? null,
    durationSeconds: row.durationSeconds ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt,
  };
}
