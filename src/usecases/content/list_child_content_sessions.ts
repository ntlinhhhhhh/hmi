import { db } from "../../db/client.ts";
import { listChildContentSessionRows } from "../../db/queries/learning_queries.ts";
import { AppError } from "../app_error.ts";
import { requireOwnedActiveParentChild, normalizeUseCaseUuid } from "../parent_child_access.ts";

export type ListChildContentSessionsInput = {
  parentId: string;
  childId: string;
  type?: string;
  status?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
};

export type ContentSessionResult = {
  id: string;
  childId: string;
  contentId: string;
  unlockContentId: string;
  durationSeconds: number | null;
  isCorrect: boolean | null;
  starsEarned: number;
  aiMatchScore: number | null;
  selectedEmotion: string | null;
  idempotencyKey: string | null;
  startedAt: string | null;
  completedAt: string | null;
  aiDetectedEmotion: string | null;
  aiConfidence: number | null;
  aiScores: Record<string, number> | null;
  metadata: Record<string, unknown> | null;
  status: string;
  createdAt: string;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function listChildContentSessions(
  input: ListChildContentSessionsInput,
): Promise<{ sessions: ContentSessionResult[]; nextCursor: string | null }> {
  const parentId = normalizeUseCaseUuid(input.parentId, "MISSING_PARENT_ID", "INVALID_PARENT_ID", "Parent ID");
  const childId = normalizeUseCaseUuid(input.childId, "MISSING_CHILD_ID", "INVALID_CHILD_ID", "Child ID");

  let limit = DEFAULT_LIMIT;
  if (input.limit !== undefined) {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > MAX_LIMIT) {
      throw new AppError("INVALID_LIMIT", `Limit must be an integer from 1 to ${MAX_LIMIT}.`, 400);
    }
    limit = input.limit;
  }

  // Validate type if present
  if (input.type && !["LECTURE", "QUIZ", "GAME"].includes(input.type)) {
    throw new AppError("INVALID_TYPE", "Type must be LECTURE, QUIZ, or GAME.", 400);
  }

  // Validate status if present
  if (input.status && !["COMPLETED", "ABANDONED"].includes(input.status)) {
    throw new AppError("INVALID_STATUS", "Status must be COMPLETED or ABANDONED.", 400);
  }

  // Verify child exists and parent owns it
  await requireOwnedActiveParentChild({ parentId, childId });

  const rows = await listChildContentSessionRows(db, childId, {
    type: input.type,
    status: input.status,
    from: input.from,
    to: input.to,
    cursor: input.cursor,
    limit: limit + 1, // Get one extra to determine if there is a next page
  });

  const hasNextPage = rows.length > limit;
  const slicedRows = hasNextPage ? rows.slice(0, limit) : rows;

  const sessions: ContentSessionResult[] = slicedRows.map(({ session, contentId }) => ({
    id: session.id,
    childId: session.childId,
    contentId: contentId,
    unlockContentId: session.unlockContentId,
    durationSeconds: session.durationSeconds,
    isCorrect: session.isCorrect,
    starsEarned: session.starsEarned,
    aiMatchScore: session.aiMatchScore,
    selectedEmotion: session.selectedEmotion,
    idempotencyKey: session.idempotencyKey,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    aiDetectedEmotion: session.aiDetectedEmotion,
    aiConfidence: session.aiConfidence,
    aiScores: session.aiScores,
    metadata: session.metadata,
    status: session.status,
    createdAt: session.createdAt,
  }));

  const lastRow = slicedRows[slicedRows.length - 1];
  const nextCursor = hasNextPage && lastRow ? lastRow.session.createdAt : null;

  return {
    sessions,
    nextCursor,
  };
}
