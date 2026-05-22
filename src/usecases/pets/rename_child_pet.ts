import { db } from "../../db/client.ts";
import { getChildProfileById } from "../../db/queries/child_profile_queries.ts";
import { getChildPetById, updateChildPetCustomName } from "../../db/queries/store_queries.ts";
import { getUserById } from "../../db/queries/user_queries.ts";
import { isValidUuid } from "../../utils/validation.ts";
import { AppError } from "../app_error.ts";

export type RenameChildPetErrorType =
  | "MISSING_PARENT_ID"
  | "INVALID_PARENT_ID"
  | "MISSING_CHILD_ID"
  | "INVALID_CHILD_ID"
  | "MISSING_CHILD_PET_ID"
  | "INVALID_CHILD_PET_ID"
  | "PARENT_NOT_FOUND"
  | "PARENT_NOT_ACTIVE"
  | "CHILD_NOT_FOUND"
  | "CHILD_NOT_OWNED"
  | "CHILD_PET_NOT_FOUND"
  | "INVALID_CUSTOM_NAME"
  | "INTERNAL_ERROR";

export type RenameChildPetInput = {
  parentId: string;
  childId: string;
  childPetId: string;
  customName: string | null;
};

export type RenamedChildPetResult = {
  id: string;
  childId: string;
  petId: string;
  customName: string | null;
  unlockedAt: string;
  pet: {
    id: string;
    name: string;
    imageUrl: string;
    animationUrl: string | null;
  };
};

function normalizeUuid<T extends RenameChildPetErrorType>(
  value: string,
  missingType: T,
  invalidType: T,
  label: string,
): string {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new AppError<RenameChildPetErrorType>(missingType, `${label} is required.`, 400);
  }

  if (!isValidUuid(normalizedValue)) {
    throw new AppError<RenameChildPetErrorType>(invalidType, `Invalid ${label} format.`, 400);
  }

  return normalizedValue;
}

function normalizeCustomName(customName: string | null): string | null {
  if (customName === null) return null;

  const value = customName.trim().replace(/\s+/g, " ");
  if (!value) return null;

  if (value.length > 80) {
    throw new AppError<RenameChildPetErrorType>(
      "INVALID_CUSTOM_NAME",
      "Custom pet name must be 80 characters or fewer.",
      400,
    );
  }

  return value;
}

export async function renameChildPet(input: RenameChildPetInput): Promise<RenamedChildPetResult> {
  const parentId = normalizeUuid(
    input.parentId,
    "MISSING_PARENT_ID",
    "INVALID_PARENT_ID",
    "parent ID",
  );
  const childId = normalizeUuid(input.childId, "MISSING_CHILD_ID", "INVALID_CHILD_ID", "child ID");
  const childPetId = normalizeUuid(
    input.childPetId,
    "MISSING_CHILD_PET_ID",
    "INVALID_CHILD_PET_ID",
    "child pet ID",
  );
  const customName = normalizeCustomName(input.customName);

  try {
    const parent = await getUserById(db, parentId);

    if (!parent || parent.role !== "PARENT") {
      throw new AppError<RenameChildPetErrorType>(
        "PARENT_NOT_FOUND",
        "Parent account not found.",
        404,
      );
    }

    if (parent.status !== "ACTIVE") {
      throw new AppError<RenameChildPetErrorType>(
        "PARENT_NOT_ACTIVE",
        "Parent account is not active.",
        403,
      );
    }

    const child = await getChildProfileById(db, childId);

    if (!child) {
      throw new AppError<RenameChildPetErrorType>(
        "CHILD_NOT_FOUND",
        "Child profile not found.",
        404,
      );
    }

    if (child.parentId !== parentId) {
      throw new AppError<RenameChildPetErrorType>(
        "CHILD_NOT_OWNED",
        "Child profile is not owned by the authenticated parent.",
        403,
      );
    }

    const childPet = await getChildPetById(db, childPetId);

    if (!childPet || childPet.childId !== childId) {
      throw new AppError<RenameChildPetErrorType>(
        "CHILD_PET_NOT_FOUND",
        "Child pet ownership record not found.",
        404,
      );
    }

    const updatedChildPet = await updateChildPetCustomName(db, childPetId, customName);

    return {
      id: updatedChildPet.id,
      childId: updatedChildPet.childId,
      petId: updatedChildPet.petId,
      customName: updatedChildPet.customName ?? null,
      unlockedAt: updatedChildPet.unlockedAt,
      pet: {
        id: childPet.pet.id,
        name: childPet.pet.name,
        imageUrl: childPet.pet.imageUrl,
        animationUrl: childPet.pet.animationUrl ?? null,
      },
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("[ERROR] Unexpected error in use case: Rename child pet", error);
    throw new AppError<RenameChildPetErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
