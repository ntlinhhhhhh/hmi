import { db } from "../../../db/client.ts";
import { getAdminStorePets } from "../../../db/queries/store_queries.ts";
import { AppError } from "../../app_error.ts";
import {
  normalizeAdminId,
  requireActiveAdmin,
  type AdminAuthorizationErrorType,
} from "../admin_authorization.ts";
import { normalizePetStatus, toPetCatalogResult, type PetCatalogResult } from "./pet_catalog.ts";

export type ListAdminPetsErrorType =
  | AdminAuthorizationErrorType
  | "INVALID_STATUS"
  | "INVALID_SEARCH"
  | "INVALID_LIMIT"
  | "INTERNAL_ERROR";

export type ListAdminPetsInput = {
  adminId: string;
  status?: string;
  search?: string;
  cursor?: string;
  limit?: number;
};

export type ListAdminPetsResult = {
  pets: PetCatalogResult[];
  nextCursor: string | null;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function normalizeSearch(search: string | undefined): string | undefined {
  if (search === undefined || search.trim() === "") return undefined;

  const value = search.trim().replace(/\s+/g, " ");
  if (value.length > 120) {
    throw new AppError<ListAdminPetsErrorType>(
      "INVALID_SEARCH",
      "Search must be 120 characters or fewer.",
      400,
    );
  }

  return value;
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT;

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new AppError<ListAdminPetsErrorType>(
      "INVALID_LIMIT",
      `Limit must be an integer from 1 to ${MAX_LIMIT}.`,
      400,
    );
  }

  return limit;
}

export async function listAdminPets(input: ListAdminPetsInput): Promise<ListAdminPetsResult> {
  const adminId = normalizeAdminId(input.adminId);
  const status = normalizePetStatus(input.status, "INVALID_STATUS");
  const search = normalizeSearch(input.search);
  const limit = normalizeLimit(input.limit);

  try {
    await requireActiveAdmin(adminId);

    const rows = await getAdminStorePets(db, {
      status,
      search,
      cursor: input.cursor,
      limit: limit + 1,
    });

    const hasNextPage = rows.length > limit;
    const slicedRows = hasNextPage ? rows.slice(0, limit) : rows;

    const pets = slicedRows.map(toPetCatalogResult);
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

    console.error("[ERROR] Unexpected error in use case: List admin pets", error);
    throw new AppError<ListAdminPetsErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
