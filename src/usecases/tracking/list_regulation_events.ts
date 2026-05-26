import { db } from "../../db/client.ts";
import { listRegulationEvents as listRegulationEventRows } from "../../db/queries/regulation_queries.ts";
import { AppError } from "../app_error.ts";
import {
  normalizeUseCaseUuid,
  requireOwnedActiveParentChild,
  type ParentChildAccessErrorType,
} from "../parent_child_access.ts";
import {
  normalizeOptionalRegulationAction,
  toRegulationEventResult,
  type RegulationEventResult,
} from "./regulation_models.ts";

export type ListRegulationEventsErrorType =
  | ParentChildAccessErrorType
  | "INVALID_ACTION"
  | "INVALID_DATE_RANGE"
  | "INVALID_CURSOR"
  | "INVALID_LIMIT"
  | "INTERNAL_ERROR";

export type ListRegulationEventsInput = {
  parentId: string;
  childId: string;
  action?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
};

export type ListRegulationEventsResult = {
  regulationEvents: RegulationEventResult[];
  nextCursor: string | null;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function normalizeDate(value: string | undefined, type: "INVALID_DATE_RANGE" | "INVALID_CURSOR") {
  if (value === undefined || value.trim() === "") return undefined;

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError<ListRegulationEventsErrorType>(type, "Invalid ISO date value.", 400);
  }

  return parsedDate.toISOString();
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT;

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new AppError<ListRegulationEventsErrorType>(
      "INVALID_LIMIT",
      `Limit must be an integer from 1 to ${MAX_LIMIT}.`,
      400,
    );
  }

  return limit;
}

export async function listChildRegulationEvents(
  input: ListRegulationEventsInput,
): Promise<ListRegulationEventsResult> {
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
  const action = normalizeOptionalRegulationAction(input.action, "INVALID_ACTION");
  const from = normalizeDate(input.from, "INVALID_DATE_RANGE");
  const to = normalizeDate(input.to, "INVALID_DATE_RANGE");
  const cursor = normalizeDate(input.cursor, "INVALID_CURSOR");
  const limit = normalizeLimit(input.limit);

  if (from !== undefined && to !== undefined && from > to) {
    throw new AppError<ListRegulationEventsErrorType>(
      "INVALID_DATE_RANGE",
      "from must be earlier than or equal to to.",
      400,
    );
  }

  try {
    await requireOwnedActiveParentChild({ parentId, childId });

    const rows = await listRegulationEventRows(db, childId, {
      action,
      from,
      to,
      cursor,
      limit: limit + 1,
    });
    const hasNextPage = rows.length > limit;
    const visibleRows = hasNextPage ? rows.slice(0, limit) : rows;

    return {
      regulationEvents: visibleRows.map(toRegulationEventResult),
      nextCursor: hasNextPage ? (visibleRows.at(-1)?.createdAt ?? null) : null,
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("[ERROR] Unexpected error in use case: List regulation events", error);
    throw new AppError<ListRegulationEventsErrorType>(
      "INTERNAL_ERROR",
      "Internal server error.",
      500,
    );
  }
}
