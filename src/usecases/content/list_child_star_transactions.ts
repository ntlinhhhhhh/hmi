import { db } from "../../db/client.ts";
import { starTransactions } from "../../db/schema.ts";
import { eq, and, lt, desc } from "drizzle-orm";
import { AppError } from "../app_error.ts";
import { requireOwnedActiveParentChild, normalizeUseCaseUuid } from "../parent_child_access.ts";

export type ListChildStarTransactionsInput = {
  parentId: string;
  childId: string;
  cursor?: string;
  limit?: number;
};

export type StarTransactionResult = {
  id: string;
  childId: string;
  amount: number;
  type: string;
  sourceId: string;
  createdAt: string;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function listChildStarTransactions(
  input: ListChildStarTransactionsInput,
): Promise<{ transactions: StarTransactionResult[]; nextCursor: string | null }> {
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

  const conditions = [eq(starTransactions.childId, childId)];
  if (input.cursor !== undefined && input.cursor.trim() !== "") {
    conditions.push(lt(starTransactions.createdAt, input.cursor));
  }

  const rows = await db.query.starTransactions.findMany({
    where: and(...conditions),
    orderBy: [desc(starTransactions.createdAt)],
    limit: limit + 1,
  });

  const hasNextPage = rows.length > limit;
  const slicedRows = hasNextPage ? rows.slice(0, limit) : rows;

  const transactions: StarTransactionResult[] = slicedRows.map((row) => ({
    id: row.id,
    childId: row.childId,
    amount: row.amount,
    type: row.type,
    sourceId: row.sourceId,
    createdAt: row.createdAt,
  }));

  const lastRow = slicedRows[slicedRows.length - 1];
  const nextCursor = hasNextPage && lastRow ? lastRow.createdAt : null;

  return {
    transactions,
    nextCursor,
  };
}
