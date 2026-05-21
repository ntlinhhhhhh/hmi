import { randomUUID } from "crypto";
import { db, withTx } from "../../db/client.ts";
import { createChildProfileTx } from "../../db/queries/child_profile_queries.ts";
import { getUserById } from "../../db/queries/user_queries.ts";
import { isValidUuid } from "../../utils/validation.ts";
import { AppError } from "../app_error.ts";
import {
  getPgConstraintName,
  isPgErrorCode,
  PgErrorCode,
} from "../postgres_error.ts";

export type CreateChildProfileErrorType =
  | "MISSING_PARENT_ID"
  | "INVALID_PARENT_ID"
  | "PARENT_NOT_FOUND"
  | "PARENT_NOT_ACTIVE"
  | "MISSING_NICKNAME"
  | "INVALID_NICKNAME"
  | "INVALID_AVATAR_URL"
  | "INVALID_BIRTH_YEAR"
  | "INTERNAL_ERROR";

export type CreateChildProfileInput = {
  parentId: string;
  nickname: string;
  birthYear: number;
  avatarUrl?: string;
};

export type ChildProfileResult = {
  id: string;
  parentId: string;
  nickname: string;
  avatarUrl: string | null;
  birthYear: number;
  totalStars: number;
  createdAt: string;
  updatedAt: string;
};

function normalizeParentId(parentId: string): string {
  const value = parentId.trim();

  if (!value) {
    throw new AppError<CreateChildProfileErrorType>(
      "MISSING_PARENT_ID",
      "Parent ID is required.",
      400,
    );
  }

  if (!isValidUuid(value)) {
    throw new AppError<CreateChildProfileErrorType>(
      "INVALID_PARENT_ID",
      "Invalid parent ID format.",
      400,
    );
  }

  return value;
}

function normalizeNickname(nickname: string): string {
  const value = nickname.trim().replace(/\s+/g, " ");

  if (!value) {
    throw new AppError<CreateChildProfileErrorType>(
      "MISSING_NICKNAME",
      "Nickname is required.",
      400,
    );
  }

  if (value.length > 80) {
    throw new AppError<CreateChildProfileErrorType>(
      "INVALID_NICKNAME",
      "Nickname must be 80 characters or fewer.",
      400,
    );
  }

  return value;
}

function normalizeAvatarUrl(avatarUrl: string | undefined): string | undefined {
  if (avatarUrl === undefined) return undefined;

  const value = avatarUrl.trim();
  if (!value) return undefined;

  if (value.length > 2048) {
    throw new AppError<CreateChildProfileErrorType>(
      "INVALID_AVATAR_URL",
      "Avatar URL is too long.",
      400,
    );
  }

  return value;
}

function validateBirthYear(birthYear: number): number {
  const currentYear = new Date().getFullYear();

  if (
    !Number.isInteger(birthYear) ||
    birthYear < currentYear - 18 ||
    birthYear > currentYear
  ) {
    throw new AppError<CreateChildProfileErrorType>(
      "INVALID_BIRTH_YEAR",
      `Birth year must be between ${currentYear - 18} and ${currentYear}.`,
      400,
    );
  }

  return birthYear;
}

function getTargetDifficulty(birthYear: number): number {
  const age = new Date().getFullYear() - birthYear;
  if (age <= 5) return 1;
  if (age <= 9) return 2;
  return 3;
}

function toChildProfileResult(child: ChildProfileResult): ChildProfileResult {
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

export async function createChildProfile(
  input: CreateChildProfileInput,
): Promise<ChildProfileResult> {
  const parentId = normalizeParentId(input.parentId);
  const nickname = normalizeNickname(input.nickname);
  const birthYear = validateBirthYear(input.birthYear);
  const avatarUrl = normalizeAvatarUrl(input.avatarUrl);
  const targetDifficulty = getTargetDifficulty(birthYear);

  try {
    const parent = await getUserById(db, parentId);

    if (!parent || parent.role !== "PARENT") {
      throw new AppError<CreateChildProfileErrorType>(
        "PARENT_NOT_FOUND",
        "Parent account not found.",
        404,
      );
    }

    if (parent.status !== "ACTIVE") {
      throw new AppError<CreateChildProfileErrorType>(
        "PARENT_NOT_ACTIVE",
        "Parent account is not active.",
        403,
      );
    }

    const child = await withTx(async (tx) =>
      createChildProfileTx(
        tx,
        {
          id: randomUUID(),
          parentId,
          nickname,
          avatarUrl,
          birthYear,
        },
        targetDifficulty,
      ),
    );

    return toChildProfileResult(child);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    if (
      isPgErrorCode(error, PgErrorCode.FOREIGN_KEY_VIOLATION) &&
      getPgConstraintName(error) === "child_profiles_parent_id_fkey"
    ) {
      throw new AppError<CreateChildProfileErrorType>(
        "PARENT_NOT_FOUND",
        "Parent account not found.",
        404,
      );
    }

    console.error(
      "[ERROR] Unexpected error in use case: Create child profile",
      error,
    );
    throw new AppError<CreateChildProfileErrorType>(
      "INTERNAL_ERROR",
      "Internal server error.",
      500,
    );
  }
}
