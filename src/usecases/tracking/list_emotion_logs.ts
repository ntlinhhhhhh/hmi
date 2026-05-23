import { db } from "../../db/client.ts";
import { listEmotionLogs as listEmotionLogRows } from "../../db/queries/tracking_queries.ts";
import { AppError } from "../app_error.ts";
import {
  normalizeUseCaseUuid,
  requireOwnedActiveParentChild,
  type ParentChildAccessErrorType,
} from "../parent_child_access.ts";
import { VALID_EMOTIONS, VALID_TRIGGER_SOURCES } from "./log_emotion.ts";

export type ListEmotionLogsErrorType =
  | ParentChildAccessErrorType
  | "INVALID_EMOTION_VALUE"
  | "INVALID_TRIGGER_SOURCE"
  | "INVALID_DATE_RANGE"
  | "INVALID_CURSOR"
  | "INVALID_LIMIT"
  | "INTERNAL_ERROR";

export type ListEmotionLogsInput = {
  parentId: string;
  childId: string;
  emotionValue?: string;
  triggerSource?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
};

export type EmotionLogListItem = {
  id: string;
  childId: string;
  emotionValue: string;
  triggerSource: string;
  durationSeconds: number | null;
  createdAt: string;
};

export type ListEmotionLogsResult = {
  logs: EmotionLogListItem[];
  nextCursor: string | null;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function normalizeEmotionValue(emotionValue: string | undefined): string | undefined {
  if (emotionValue === undefined || emotionValue.trim() === "") return undefined;

  const normalizedValue = emotionValue.trim().toUpperCase();
  if (!VALID_EMOTIONS.has(normalizedValue)) {
    throw new AppError<ListEmotionLogsErrorType>(
      "INVALID_EMOTION_VALUE",
      "Unsupported emotion value.",
      400,
    );
  }

  return normalizedValue;
}

function normalizeTriggerSource(triggerSource: string | undefined): string | undefined {
  if (triggerSource === undefined || triggerSource.trim() === "") return undefined;

  const normalizedValue = triggerSource.trim().toUpperCase();
  if (!VALID_TRIGGER_SOURCES.has(normalizedValue)) {
    throw new AppError<ListEmotionLogsErrorType>(
      "INVALID_TRIGGER_SOURCE",
      "Unsupported trigger source.",
      400,
    );
  }

  return normalizedValue;
}

function normalizeDate(value: string | undefined, type: "INVALID_DATE_RANGE" | "INVALID_CURSOR") {
  if (value === undefined || value.trim() === "") return undefined;

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError<ListEmotionLogsErrorType>(type, "Invalid ISO date value.", 400);
  }

  return parsedDate.toISOString();
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT;

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new AppError<ListEmotionLogsErrorType>(
      "INVALID_LIMIT",
      `Limit must be an integer from 1 to ${MAX_LIMIT}.`,
      400,
    );
  }

  return limit;
}

export async function listEmotionLogs(input: ListEmotionLogsInput): Promise<ListEmotionLogsResult> {
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
  const emotionValue = normalizeEmotionValue(input.emotionValue);
  const triggerSource = normalizeTriggerSource(input.triggerSource);
  const from = normalizeDate(input.from, "INVALID_DATE_RANGE");
  const to = normalizeDate(input.to, "INVALID_DATE_RANGE");
  const cursor = normalizeDate(input.cursor, "INVALID_CURSOR");
  const limit = normalizeLimit(input.limit);

  if (from !== undefined && to !== undefined && from > to) {
    throw new AppError<ListEmotionLogsErrorType>(
      "INVALID_DATE_RANGE",
      "from must be earlier than or equal to to.",
      400,
    );
  }

  try {
    await requireOwnedActiveParentChild({ parentId, childId });

    const rows = await listEmotionLogRows(db, childId, {
      emotionValue,
      triggerSource,
      from,
      to,
      cursor,
      limit: limit + 1,
    });
    const hasNextPage = rows.length > limit;
    const visibleRows = hasNextPage ? rows.slice(0, limit) : rows;

    return {
      logs: visibleRows.map((log) => ({
        id: log.id,
        childId: log.childId,
        emotionValue: log.emotionValue,
        triggerSource: log.triggerSource,
        durationSeconds: log.durationSeconds ?? null,
        createdAt: log.createdAt,
      })),
      nextCursor: hasNextPage ? (visibleRows.at(-1)?.createdAt ?? null) : null,
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("[ERROR] Unexpected error in use case: List emotion logs", error);
    throw new AppError<ListEmotionLogsErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
