import { isValidUuid } from "../../../utils/validation.ts";
import { AppError } from "../../app_error.ts";

export type AdminUserRole = "PARENT" | "ADMIN";
export type AdminUserStatus = "ACTIVE" | "BANNED";

export type AdminUserRow = {
  id: string;
  email: string;
  phoneNumber: string | null;
  authProvider: string;
  fullName: string | null;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserResult = {
  id: string;
  email: string;
  phoneNumber: string | null;
  authProvider: string;
  fullName: string | null;
  role: AdminUserRole;
  status: AdminUserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserDetailResult = {
  user: AdminUserResult;
  childCount: number;
  sessions: {
    totalSessions: number;
    activeSessions: number;
    lastUsedAt: string | null;
  };
};

export function normalizeUserId<TError extends string>(userId: string, errorType: TError): string {
  const value = userId.trim();

  if (!value || !isValidUuid(value)) {
    throw new AppError<TError>(errorType, "Invalid user ID format.", 400);
  }

  return value;
}

export function normalizeAdminUserRole<TError extends string>(
  role: string | undefined,
  errorType: TError,
): AdminUserRole | undefined {
  if (role === undefined || role.trim() === "") return undefined;

  const value = role.trim().toUpperCase();
  if (value !== "PARENT" && value !== "ADMIN") {
    throw new AppError<TError>(errorType, "role must be PARENT or ADMIN.", 400);
  }

  return value;
}

export function normalizeAdminUserStatus<TError extends string>(
  status: string | undefined,
  errorType: TError,
): AdminUserStatus | undefined {
  if (status === undefined || status.trim() === "") return undefined;

  const value = status.trim().toUpperCase();
  if (value !== "ACTIVE" && value !== "BANNED") {
    throw new AppError<TError>(errorType, "status must be ACTIVE or BANNED.", 400);
  }

  return value;
}

export function toAdminUserResult(row: AdminUserRow): AdminUserResult {
  const role = row.role === "ADMIN" ? "ADMIN" : "PARENT";
  const status = row.status === "BANNED" ? "BANNED" : "ACTIVE";

  return {
    id: row.id,
    email: row.email,
    phoneNumber: row.phoneNumber ?? null,
    authProvider: row.authProvider,
    fullName: row.fullName ?? null,
    role,
    status,
    lastLoginAt: row.lastLoginAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
