import { randomUUID } from "crypto";
import { db } from "../../db/client.ts";
import {
  getChildProfileById,
  updateChildProfile as updateChildProfileRow,
} from "../../db/queries/child_profile_queries.ts";
import { getUserById } from "../../db/queries/user_queries.ts";
import { deleteFile, getFileUrl, uploadFile } from "../../storage/s3.ts";
import { isValidUuid } from "../../utils/validation.ts";
import { AppError } from "../app_error.ts";
import type { ChildProfileResult } from "./create_child_profile.ts";

export type UpdateChildProfileErrorType =
  | "MISSING_PARENT_ID"
  | "INVALID_PARENT_ID"
  | "MISSING_CHILD_ID"
  | "INVALID_CHILD_ID"
  | "PARENT_NOT_FOUND"
  | "PARENT_NOT_ACTIVE"
  | "CHILD_NOT_FOUND"
  | "CHILD_NOT_OWNED"
  | "MISSING_UPDATE_FIELDS"
  | "MISSING_NICKNAME"
  | "INVALID_NICKNAME"
  | "INVALID_AVATAR_FILE"
  | "AVATAR_TOO_LARGE"
  | "STORAGE_ERROR"
  | "INTERNAL_ERROR";

type UploadedAvatar = {
  buffer: Uint8Array;
  contentType: string;
  size: number;
};

type NormalizedAvatar = UploadedAvatar & {
  extension: string;
};

export type UpdateChildProfileInput = {
  parentId: string;
  childId: string;
  nickname?: string;
  avatar?: UploadedAvatar;
};

const avatarContentTypes = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
]);

const maxAvatarBytes = 5 * 1024 * 1024;

function normalizeUuid<T extends UpdateChildProfileErrorType>(
  value: string,
  missingType: T,
  invalidType: T,
  label: string,
): string {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new AppError<UpdateChildProfileErrorType>(missingType, `${label} is required.`, 400);
  }

  if (!isValidUuid(normalizedValue)) {
    throw new AppError<UpdateChildProfileErrorType>(invalidType, `Invalid ${label} format.`, 400);
  }

  return normalizedValue;
}

function normalizeNickname(nickname: string | undefined): string | undefined {
  if (nickname === undefined) return undefined;

  const value = nickname.trim().replace(/\s+/g, " ");

  if (!value) {
    throw new AppError<UpdateChildProfileErrorType>(
      "MISSING_NICKNAME",
      "Nickname is required.",
      400,
    );
  }

  if (value.length > 80) {
    throw new AppError<UpdateChildProfileErrorType>(
      "INVALID_NICKNAME",
      "Nickname must be 80 characters or fewer.",
      400,
    );
  }

  return value;
}

function normalizeAvatar(avatar: UploadedAvatar | undefined): NormalizedAvatar | undefined {
  if (avatar === undefined) return undefined;

  const contentType = avatar.contentType.trim().toLowerCase();
  const extension = avatarContentTypes.get(contentType);

  if (!extension || avatar.size <= 0) {
    throw new AppError<UpdateChildProfileErrorType>(
      "INVALID_AVATAR_FILE",
      "Avatar must be a valid image file.",
      400,
    );
  }

  if (avatar.size > maxAvatarBytes || avatar.buffer.byteLength > maxAvatarBytes) {
    throw new AppError<UpdateChildProfileErrorType>(
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

async function uploadAvatar(
  parentId: string,
  childId: string,
  avatar: NormalizedAvatar | undefined,
): Promise<string | null> {
  if (!avatar) return null;

  const objectKey = `child-avatars/${parentId}/${childId}/${randomUUID()}.${avatar.extension}`;

  try {
    await uploadFile(objectKey, avatar.buffer, avatar.contentType);
  } catch (error) {
    console.error("[ERROR] Failed to upload child avatar to S3", error);
    throw new AppError<UpdateChildProfileErrorType>(
      "STORAGE_ERROR",
      "Failed to upload avatar.",
      502,
    );
  }

  return objectKey;
}

async function toChildProfileResult(child: ChildProfileResult): Promise<ChildProfileResult> {
  return {
    id: child.id,
    parentId: child.parentId,
    nickname: child.nickname,
    avatarUrl: child.avatarUrl ? await getFileUrl(child.avatarUrl) : null,
    birthYear: child.birthYear,
    totalStars: child.totalStars,
    createdAt: child.createdAt,
    updatedAt: child.updatedAt,
  };
}

export async function updateChildProfile(
  input: UpdateChildProfileInput,
): Promise<ChildProfileResult> {
  const parentId = normalizeUuid(
    input.parentId,
    "MISSING_PARENT_ID",
    "INVALID_PARENT_ID",
    "parent ID",
  );
  const childId = normalizeUuid(input.childId, "MISSING_CHILD_ID", "INVALID_CHILD_ID", "child ID");
  const nickname = normalizeNickname(input.nickname);
  const avatar = normalizeAvatar(input.avatar);

  if (nickname === undefined && avatar === undefined) {
    throw new AppError<UpdateChildProfileErrorType>(
      "MISSING_UPDATE_FIELDS",
      "At least one child profile field is required.",
      400,
    );
  }

  let uploadedAvatarKey: string | null = null;
  let oldAvatarKey: string | null = null;
  let updateCommitted = false;

  try {
    const parent = await getUserById(db, parentId);

    if (!parent || parent.role !== "PARENT") {
      throw new AppError<UpdateChildProfileErrorType>(
        "PARENT_NOT_FOUND",
        "Parent account not found.",
        404,
      );
    }

    if (parent.status !== "ACTIVE") {
      throw new AppError<UpdateChildProfileErrorType>(
        "PARENT_NOT_ACTIVE",
        "Parent account is not active.",
        403,
      );
    }

    const child = await getChildProfileById(db, childId);

    if (!child) {
      throw new AppError<UpdateChildProfileErrorType>(
        "CHILD_NOT_FOUND",
        "Child profile not found.",
        404,
      );
    }

    if (child.parentId !== parentId) {
      throw new AppError<UpdateChildProfileErrorType>(
        "CHILD_NOT_OWNED",
        "Child profile is not owned by the authenticated parent.",
        403,
      );
    }

    oldAvatarKey = child.avatarUrl ?? null;
    uploadedAvatarKey = await uploadAvatar(parentId, childId, avatar);

    const updatedChild = await updateChildProfileRow(db, childId, {
      ...(nickname !== undefined ? { nickname } : {}),
      ...(uploadedAvatarKey !== null ? { avatarUrl: uploadedAvatarKey } : {}),
    });
    updateCommitted = true;

    if (oldAvatarKey && uploadedAvatarKey && oldAvatarKey !== uploadedAvatarKey) {
      void deleteFile(oldAvatarKey).catch((cleanupError: unknown) => {
        console.error("[WARN] Failed to delete replaced child avatar from S3", cleanupError);
      });
    }

    return await toChildProfileResult(updatedChild);
  } catch (error: unknown) {
    if (uploadedAvatarKey && !updateCommitted) {
      void deleteFile(uploadedAvatarKey).catch((cleanupError: unknown) => {
        console.error("[WARN] Failed to delete orphaned child avatar from S3", cleanupError);
      });
    }

    if (error instanceof AppError) {
      throw error;
    }

    console.error("[ERROR] Unexpected error in use case: Update child profile", error);
    throw new AppError<UpdateChildProfileErrorType>(
      "INTERNAL_ERROR",
      "Internal server error.",
      500,
    );
  }
}
