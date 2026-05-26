import { db } from "../../db/client.ts";
import { listChildAlertRows } from "../../db/queries/tracking_queries.ts";
import { AppError } from "../app_error.ts";
import { requireOwnedActiveParentChild, normalizeUseCaseUuid } from "../parent_child_access.ts";

export type ListChildAlertsInput = {
  parentId: string;
  childId: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
};

export type AlertResult = {
  id: string;
  childId: string;
  emotionValue: string;
  triggerSource: string;
  durationSeconds: number | null;
  confidenceScore: number | null;
  aiEmotionLabel: string | null;
  aiConfidence: number | null;
  aiScores: Record<string, number> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function listChildAlerts(
  input: ListChildAlertsInput,
): Promise<{ alerts: AlertResult[]; nextCursor: string | null }> {
  const parentId = normalizeUseCaseUuid(input.parentId, "MISSING_PARENT_ID", "INVALID_PARENT_ID", "Parent ID");
  const childId = normalizeUseCaseUuid(input.childId, "MISSING_CHILD_ID", "INVALID_CHILD_ID", "Child ID");

  let limit = DEFAULT_LIMIT;
  if (input.limit !== undefined) {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > MAX_LIMIT) {
      throw new AppError("INVALID_LIMIT", `Limit must be an integer from 1 to ${MAX_LIMIT}.`, 400);
    }
    limit = input.limit;
  }

  // Verify child exists and belongs to parent
  await requireOwnedActiveParentChild({ parentId, childId });

  const rows = await listChildAlertRows(db, childId, {
    from: input.from,
    to: input.to,
    cursor: input.cursor,
    limit: limit + 1, // Get one extra to determine next page
  });

  const hasNextPage = rows.length > limit;
  const slicedRows = hasNextPage ? rows.slice(0, limit) : rows;

  const alerts: AlertResult[] = slicedRows.map((row) => ({
    id: row.id,
    childId: row.childId,
    emotionValue: row.emotionValue,
    triggerSource: row.triggerSource,
    durationSeconds: row.durationSeconds,
    confidenceScore: row.confidenceScore,
    aiEmotionLabel: row.aiEmotionLabel,
    aiConfidence: row.aiConfidence,
    aiScores: row.aiScores,
    metadata: row.metadata,
    createdAt: row.createdAt,
  }));

  const lastRow = slicedRows[slicedRows.length - 1];
  const nextCursor = hasNextPage && lastRow ? lastRow.createdAt : null;

  return {
    alerts,
    nextCursor,
  };
}
