import { db } from "../../db/client.ts";
import { getChildrenByParentId } from "../../db/queries/child_profile_queries.ts";
import { getUserById } from "../../db/queries/user_queries.ts";
import { isValidUuid } from "../../utils/validation.ts";
import { AppError } from "../app_error.ts";

export type ListChildProfilesErrorType =
  | "MISSING_PARENT_ID"
  | "INVALID_PARENT_ID"
  | "PARENT_NOT_FOUND"
  | "PARENT_NOT_ACTIVE"
  | "INTERNAL_ERROR";

export type ChildProfileListItem = {
  id: string;
  parentId: string;
  nickname: string;
  avatarUrl: string | null;
  birthYear: number;
  totalStars: number;
  createdAt: string;
  updatedAt: string;
  preferences: {
    isHighContrast: boolean;
    preferencesData: unknown;
  } | null;
};

function normalizeParentId(parentId: string): string {
  const value = parentId.trim();

  if (!value) {
    throw new AppError<ListChildProfilesErrorType>(
      "MISSING_PARENT_ID",
      "Parent ID is required.",
      400,
    );
  }

  if (!isValidUuid(value)) {
    throw new AppError<ListChildProfilesErrorType>(
      "INVALID_PARENT_ID",
      "Invalid parent ID format.",
      400,
    );
  }

  return value;
}

export async function listChildProfiles(
  parentId: string,
): Promise<ChildProfileListItem[]> {
  const normalizedParentId = normalizeParentId(parentId);

  try {
    const parent = await getUserById(db, normalizedParentId);

    if (!parent || parent.role !== "PARENT") {
      throw new AppError<ListChildProfilesErrorType>(
        "PARENT_NOT_FOUND",
        "Parent account not found.",
        404,
      );
    }

    if (parent.status !== "ACTIVE") {
      throw new AppError<ListChildProfilesErrorType>(
        "PARENT_NOT_ACTIVE",
        "Parent account is not active.",
        403,
      );
    }

    const children = await getChildrenByParentId(db, normalizedParentId);

    return children.map((child) => ({
      id: child.id,
      parentId: child.parentId,
      nickname: child.nickname,
      avatarUrl: child.avatarUrl ?? null,
      birthYear: child.birthYear,
      totalStars: child.totalStars,
      createdAt: child.createdAt,
      updatedAt: child.updatedAt,
      preferences: child.preferences
        ? {
            isHighContrast: child.preferences.isHighContrast,
            preferencesData: child.preferences.preferencesData ?? null,
          }
        : null,
    }));
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error(
      "[ERROR] Unexpected error in use case: List child profiles",
      error,
    );
    throw new AppError<ListChildProfilesErrorType>(
      "INTERNAL_ERROR",
      "Internal server error.",
      500,
    );
  }
}
