import { db } from "../db/client.ts";
import { getChildProfileById } from "../db/queries/child_profile_queries.ts";
import { getUserById } from "../db/queries/user_queries.ts";
import { isValidUuid } from "../utils/validation.ts";
import { AppError } from "./app_error.ts";

export type ParentChildAccessErrorType =
  | "MISSING_PARENT_ID"
  | "INVALID_PARENT_ID"
  | "MISSING_CHILD_ID"
  | "INVALID_CHILD_ID"
  | "PARENT_NOT_FOUND"
  | "PARENT_NOT_ACTIVE"
  | "CHILD_NOT_FOUND"
  | "CHILD_NOT_OWNED";

export type OwnedChild = {
  id: string;
  parentId: string;
  nickname: string;
  avatarUrl: string | null;
  birthYear: number;
  totalStars: number;
  createdAt: string;
  updatedAt: string;
};

export function normalizeUseCaseUuid<T extends string>(
  value: string,
  missingType: T,
  invalidType: T,
  label: string,
): string {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new AppError<T>(missingType, `${label} is required.`, 400);
  }

  if (!isValidUuid(normalizedValue)) {
    throw new AppError<T>(invalidType, `Invalid ${label} format.`, 400);
  }

  return normalizedValue;
}

export async function requireOwnedActiveParentChild(input: {
  parentId: string;
  childId: string;
}): Promise<OwnedChild> {
  const parent = await getUserById(db, input.parentId);

  if (!parent || parent.role !== "PARENT") {
    throw new AppError<ParentChildAccessErrorType>(
      "PARENT_NOT_FOUND",
      "Parent account not found.",
      404,
    );
  }

  if (parent.status !== "ACTIVE") {
    throw new AppError<ParentChildAccessErrorType>(
      "PARENT_NOT_ACTIVE",
      "Parent account is not active.",
      403,
    );
  }

  const child = await getChildProfileById(db, input.childId);

  if (!child) {
    throw new AppError<ParentChildAccessErrorType>(
      "CHILD_NOT_FOUND",
      "Child profile not found.",
      404,
    );
  }

  if (child.parentId !== input.parentId) {
    throw new AppError<ParentChildAccessErrorType>(
      "CHILD_NOT_OWNED",
      "Child profile is not owned by the authenticated parent.",
      403,
    );
  }

  return {
    id: child.id,
    parentId: child.parentId,
    nickname: child.nickname,
    avatarUrl: child.avatarUrl ?? null,
    birthYear: child.birthYear,
    totalStars: child.totalStars,
    createdAt: child.createdAt,
    updatedAt: child.updatedAt,
  };
}
