import { db } from "../../db/client.ts";
import {
  deleteChildProfile as deleteChildProfileRow,
  getChildProfileById,
} from "../../db/queries/child_profile_queries.ts";
import { getUserById } from "../../db/queries/user_queries.ts";
import { deleteFile } from "../../storage/s3.ts";
import { isValidUuid } from "../../utils/validation.ts";
import { AppError } from "../app_error.ts";

export type DeleteChildProfileErrorType =
  | "MISSING_PARENT_ID"
  | "INVALID_PARENT_ID"
  | "MISSING_CHILD_ID"
  | "INVALID_CHILD_ID"
  | "PARENT_NOT_FOUND"
  | "PARENT_NOT_ACTIVE"
  | "CHILD_NOT_FOUND"
  | "CHILD_NOT_OWNED"
  | "MISSING_CONFIRMATION"
  | "INVALID_CONFIRMATION"
  | "INTERNAL_ERROR";

export type DeleteChildProfileInput = {
  parentId: string;
  childId: string;
  confirmation: string;
};

function normalizeUuid<T extends DeleteChildProfileErrorType>(
  value: string,
  missingType: T,
  invalidType: T,
  label: string,
): string {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new AppError<DeleteChildProfileErrorType>(missingType, `${label} is required.`, 400);
  }

  if (!isValidUuid(normalizedValue)) {
    throw new AppError<DeleteChildProfileErrorType>(invalidType, `Invalid ${label} format.`, 400);
  }

  return normalizedValue;
}

function validateConfirmation(confirmation: string): void {
  const value = confirmation.trim();

  if (!value) {
    throw new AppError<DeleteChildProfileErrorType>(
      "MISSING_CONFIRMATION",
      "Deletion confirmation is required.",
      400,
    );
  }

  if (value !== "DELETE") {
    throw new AppError<DeleteChildProfileErrorType>(
      "INVALID_CONFIRMATION",
      'Deletion confirmation must be exactly "DELETE".',
      400,
    );
  }
}

export async function deleteChildProfile(input: DeleteChildProfileInput): Promise<void> {
  const parentId = normalizeUuid(
    input.parentId,
    "MISSING_PARENT_ID",
    "INVALID_PARENT_ID",
    "parent ID",
  );
  const childId = normalizeUuid(input.childId, "MISSING_CHILD_ID", "INVALID_CHILD_ID", "child ID");
  validateConfirmation(input.confirmation);

  try {
    const parent = await getUserById(db, parentId);

    if (!parent || parent.role !== "PARENT") {
      throw new AppError<DeleteChildProfileErrorType>(
        "PARENT_NOT_FOUND",
        "Parent account not found.",
        404,
      );
    }

    if (parent.status !== "ACTIVE") {
      throw new AppError<DeleteChildProfileErrorType>(
        "PARENT_NOT_ACTIVE",
        "Parent account is not active.",
        403,
      );
    }

    const child = await getChildProfileById(db, childId);

    if (!child) {
      throw new AppError<DeleteChildProfileErrorType>(
        "CHILD_NOT_FOUND",
        "Child profile not found.",
        404,
      );
    }

    if (child.parentId !== parentId) {
      throw new AppError<DeleteChildProfileErrorType>(
        "CHILD_NOT_OWNED",
        "Child profile is not owned by the authenticated parent.",
        403,
      );
    }

    const deletedChild = await deleteChildProfileRow(db, childId);

    if (deletedChild.avatarUrl) {
      void deleteFile(deletedChild.avatarUrl).catch((cleanupError: unknown) => {
        console.error("[WARN] Failed to delete removed child avatar from S3", cleanupError);
      });
    }
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("[ERROR] Unexpected error in use case: Delete child profile", error);
    throw new AppError<DeleteChildProfileErrorType>(
      "INTERNAL_ERROR",
      "Internal server error.",
      500,
    );
  }
}
