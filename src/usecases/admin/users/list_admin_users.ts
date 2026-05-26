import { db } from "../../../db/client.ts";
import { listAdminUserRows } from "../../../db/queries/admin_user_queries.ts";
import { AppError } from "../../app_error.ts";
import {
  normalizeAdminId,
  requireActiveAdmin,
  type AdminAuthorizationErrorType,
} from "../admin_authorization.ts";
import {
  normalizeAdminUserRole,
  normalizeAdminUserStatus,
  toAdminUserResult,
  type AdminUserResult,
} from "./admin_user_models.ts";

export type ListAdminUsersErrorType =
  | AdminAuthorizationErrorType
  | "INVALID_ROLE"
  | "INVALID_STATUS"
  | "INVALID_SEARCH"
  | "INVALID_CURSOR"
  | "INVALID_LIMIT"
  | "INTERNAL_ERROR";

export type ListAdminUsersInput = {
  adminId: string;
  role?: string;
  status?: string;
  search?: string;
  cursor?: string;
  limit?: number;
};

export type ListAdminUsersResult = {
  users: AdminUserResult[];
  nextCursor: string | null;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function normalizeSearch(search: string | undefined): string | undefined {
  if (search === undefined || search.trim() === "") return undefined;

  const value = search.trim().replace(/\s+/g, " ");
  if (value.length > 120) {
    throw new AppError<ListAdminUsersErrorType>(
      "INVALID_SEARCH",
      "Search must be 120 characters or fewer.",
      400,
    );
  }

  return value;
}

function normalizeCursor(cursor: string | undefined): string | undefined {
  if (cursor === undefined || cursor.trim() === "") return undefined;

  const parsedDate = new Date(cursor);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError<ListAdminUsersErrorType>(
      "INVALID_CURSOR",
      "cursor must be a valid ISO date.",
      400,
    );
  }

  return parsedDate.toISOString();
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT;

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new AppError<ListAdminUsersErrorType>(
      "INVALID_LIMIT",
      `Limit must be an integer from 1 to ${MAX_LIMIT}.`,
      400,
    );
  }

  return limit;
}

export async function listAdminUsers(input: ListAdminUsersInput): Promise<ListAdminUsersResult> {
  const adminId = normalizeAdminId(input.adminId);
  const role = normalizeAdminUserRole(input.role, "INVALID_ROLE");
  const status = normalizeAdminUserStatus(input.status, "INVALID_STATUS");
  const search = normalizeSearch(input.search);
  const cursor = normalizeCursor(input.cursor);
  const limit = normalizeLimit(input.limit);

  try {
    await requireActiveAdmin(adminId);

    const rows = await listAdminUserRows(db, {
      role,
      status,
      search,
      cursor,
      limit: limit + 1,
    });
    const hasNextPage = rows.length > limit;
    const visibleRows = hasNextPage ? rows.slice(0, limit) : rows;

    return {
      users: visibleRows.map(toAdminUserResult),
      nextCursor: hasNextPage ? (visibleRows.at(-1)?.createdAt ?? null) : null,
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("[ERROR] Unexpected error in use case: List admin users", error);
    throw new AppError<ListAdminUsersErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
