import { db } from "../../db/client.ts";
import { getChildProfileById } from "../../db/queries/child_profile_queries.ts";
import { getUserById } from "../../db/queries/user_queries.ts";
import { getFileUrl } from "../../storage/s3.ts";
import { isValidUuid } from "../../utils/validation.ts";
import { AppError } from "../app_error.ts";

export type GetChildProfileErrorType =
  | "MISSING_PARENT_ID"
  | "INVALID_PARENT_ID"
  | "MISSING_CHILD_ID"
  | "INVALID_CHILD_ID"
  | "PARENT_NOT_FOUND"
  | "PARENT_NOT_ACTIVE"
  | "CHILD_NOT_FOUND"
  | "CHILD_NOT_OWNED"
  | "INTERNAL_ERROR";

export type GetChildProfileInput = {
  parentId: string;
  childId: string;
};

export type ChildProfileDetail = {
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

function normalizeUuid<T extends GetChildProfileErrorType>(
  value: string,
  missingType: T,
  invalidType: T,
  label: string,
): string {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new AppError<GetChildProfileErrorType>(missingType, `${label} is required.`, 400);
  }

  if (!isValidUuid(normalizedValue)) {
    throw new AppError<GetChildProfileErrorType>(invalidType, `Invalid ${label} format.`, 400);
  }

  return normalizedValue;
}

export async function getChildProfile(input: GetChildProfileInput): Promise<ChildProfileDetail> {
  const parentId = normalizeUuid(
    input.parentId,
    "MISSING_PARENT_ID",
    "INVALID_PARENT_ID",
    "parent ID",
  );
  const childId = normalizeUuid(input.childId, "MISSING_CHILD_ID", "INVALID_CHILD_ID", "child ID");

  try {
    const parent = await getUserById(db, parentId);

    if (!parent || parent.role !== "PARENT") {
      throw new AppError<GetChildProfileErrorType>(
        "PARENT_NOT_FOUND",
        "Parent account not found.",
        404,
      );
    }

    if (parent.status !== "ACTIVE") {
      throw new AppError<GetChildProfileErrorType>(
        "PARENT_NOT_ACTIVE",
        "Parent account is not active.",
        403,
      );
    }

    const child = await getChildProfileById(db, childId);

    if (!child) {
      throw new AppError<GetChildProfileErrorType>(
        "CHILD_NOT_FOUND",
        "Child profile not found.",
        404,
      );
    }

    if (child.parentId !== parentId) {
      throw new AppError<GetChildProfileErrorType>(
        "CHILD_NOT_OWNED",
        "Child profile is not owned by the authenticated parent.",
        403,
      );
    }

    return {
      id: child.id,
      parentId: child.parentId,
      nickname: child.nickname,
      avatarUrl: child.avatarUrl ? await getFileUrl(child.avatarUrl) : null,
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
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("[ERROR] Unexpected error in use case: Get child profile", error);
    throw new AppError<GetChildProfileErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
