import { randomUUID } from "crypto";
import { db, withTx } from "../../db/client.ts";
import { createChildProfileTx } from "../../db/queries/child_profile_queries.ts";
import { getUserById } from "../../db/queries/user_queries.ts";
import { deleteFile, getFileUrl, uploadFile } from "../../storage/s3.ts";
import { isValidUuid } from "../../utils/validation.ts";
import { AppError } from "../app_error.ts";
import { getPgConstraintName, isPgErrorCode, PgErrorCode } from "../postgres_error.ts";

export type CreateChildProfileErrorType =
  | "MISSING_PARENT_ID"
  | "INVALID_PARENT_ID"
  | "PARENT_NOT_FOUND"
  | "PARENT_NOT_ACTIVE"
  | "MISSING_NICKNAME"
  | "INVALID_NICKNAME"
  | "INVALID_AVATAR_FILE"
  | "AVATAR_TOO_LARGE"
  | "STORAGE_ERROR"
  | "INVALID_BIRTH_YEAR"
  | "INTERNAL_ERROR";

type UploadedAvatar = {
  buffer: Uint8Array;
  contentType: string;
  size: number;
};

export type CreateChildProfileInput = {
  parentId: string;
  nickname: string;
  birthYear: number;
  avatar?: UploadedAvatar;
  webcamConsent?: boolean;
};

export type ChildProfileResult = {
  id: string;
  parentId: string;
  nickname: string;
  avatarUrl: string | null;
  birthYear: number;
  totalStars: number;
  webcamConsent: boolean;
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

const avatarContentTypes = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
]);

const maxAvatarBytes = 5 * 1024 * 1024;

type NormalizedAvatar = UploadedAvatar & {
  extension: string;
};

function normalizeAvatar(avatar: UploadedAvatar | undefined): NormalizedAvatar | undefined {
  if (avatar === undefined) return undefined;

  const contentType = avatar.contentType.trim().toLowerCase();
  const extension = avatarContentTypes.get(contentType);

  if (!extension || avatar.size <= 0) {
    throw new AppError<CreateChildProfileErrorType>(
      "INVALID_AVATAR_FILE",
      "Avatar must be a valid image file.",
      400,
    );
  }

  if (avatar.size > maxAvatarBytes || avatar.buffer.byteLength > maxAvatarBytes) {
    throw new AppError<CreateChildProfileErrorType>(
      "AVATAR_TOO_LARGE",
      "Avatar file must be 5 MB or smaller.",
      413,
    );
  }

  return {
    buffer: avatar.buffer,
    contentType,
    size: avatar.size,
    extension,
  };
}

function validateBirthYear(birthYear: number): number {
  const currentYear = new Date().getFullYear();

  if (!Number.isInteger(birthYear) || birthYear < currentYear - 18 || birthYear > currentYear) {
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

async function uploadAvatar(
  parentId: string,
  childId: string,
  avatar: NormalizedAvatar | undefined,
): Promise<string | null> {
  if (!avatar) return null;

  const objectKey = `child-avatars/${parentId}/${childId}.${avatar.extension}`;

  try {
    await uploadFile(objectKey, avatar.buffer, avatar.contentType);
  } catch (error) {
    console.error("[ERROR] Failed to upload child avatar to S3", error);
    throw new AppError<CreateChildProfileErrorType>(
      "STORAGE_ERROR",
      "Failed to upload avatar.",
      502,
    );
  }

  return objectKey;
}

async function toChildProfileResult(child: any): Promise<ChildProfileResult> {
  return {
    id: child.id,
    parentId: child.parentId,
    nickname: child.nickname,
    avatarUrl: child.avatarUrl ? await getFileUrl(child.avatarUrl) : null,
    birthYear: child.birthYear,
    totalStars: child.totalStars,
    webcamConsent: !!child.webcamConsent,
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
  const avatar = normalizeAvatar(input.avatar);
  const targetDifficulty = getTargetDifficulty(birthYear);
  const childId = randomUUID();
  let uploadedAvatarKey: string | null = null;
  let childCreated = false;

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

    uploadedAvatarKey = await uploadAvatar(parentId, childId, avatar);

    const child = await withTx(async (tx) =>
      createChildProfileTx(
        tx,
        {
          id: childId,
          parentId,
          nickname,
          avatarUrl: uploadedAvatarKey,
          birthYear,
          webcamConsent: !!input.webcamConsent,
        },
        targetDifficulty,
      ),
    );
    childCreated = true;

    return await toChildProfileResult(child);
  } catch (error: unknown) {
    if (uploadedAvatarKey && !childCreated) {
      void deleteFile(uploadedAvatarKey).catch((cleanupError: unknown) => {
        console.error("[WARN] Failed to delete orphaned child avatar from S3", cleanupError);
      });
    }

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

    console.error("[ERROR] Unexpected error in use case: Create child profile", error);
    throw new AppError<CreateChildProfileErrorType>(
      "INTERNAL_ERROR",
      "Internal server error.",
      500,
    );
  }
}
