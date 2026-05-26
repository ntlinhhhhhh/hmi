import { db } from "../../db/client.ts";
import { getActiveStorePets } from "../../db/queries/store_queries.ts";
import { AppError } from "../app_error.ts";

export type ListActivePetsErrorType = "INVALID_LIMIT" | "INTERNAL_ERROR";

export type StorePetListItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  animationUrl: string | null;
  unlockStarCost: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ListActivePetsInput = {
  cursor?: string;
  limit?: number;
};

export type ListActivePetsResult = {
  pets: StorePetListItem[];
  nextCursor: string | null;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function listActivePets(input: ListActivePetsInput = {}): Promise<ListActivePetsResult> {
  let limit = DEFAULT_LIMIT;
  if (input.limit !== undefined) {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > MAX_LIMIT) {
      throw new AppError("INVALID_LIMIT", `Limit must be an integer from 1 to ${MAX_LIMIT}.`, 400);
    }
    limit = input.limit;
  }

  try {
    const rows = await getActiveStorePets(db, {
      cursor: input.cursor,
      limit: limit + 1,
    });

    const hasNextPage = rows.length > limit;
    const slicedRows = hasNextPage ? rows.slice(0, limit) : rows;

    const pets = slicedRows.map((pet) => ({
      id: pet.id,
      name: pet.name,
      description: pet.description ?? null,
      imageUrl: pet.imageUrl,
      animationUrl: pet.animationUrl ?? null,
      unlockStarCost: pet.unlockStarCost,
      status: pet.status,
      createdAt: pet.createdAt,
      updatedAt: pet.updatedAt,
    }));

    const lastRow = slicedRows[slicedRows.length - 1];
    const nextCursor = hasNextPage && lastRow ? lastRow.createdAt : null;

    return {
      pets,
      nextCursor,
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error("[ERROR] Unexpected error in use case: List active pets", error);
    throw new AppError<ListActivePetsErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
