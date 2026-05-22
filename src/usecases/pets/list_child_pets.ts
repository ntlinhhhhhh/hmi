import { db } from "../../db/client.ts";
import {
  getChildPetsByChildId,
  getChildProfileById,
} from "../../db/queries/child_profile_queries.ts";
import { getUserById } from "../../db/queries/user_queries.ts";
import { isValidUuid } from "../../utils/validation.ts";
import { AppError } from "../app_error.ts";

export type ListChildPetsErrorType =
  | "MISSING_PARENT_ID"
  | "INVALID_PARENT_ID"
  | "MISSING_CHILD_ID"
  | "INVALID_CHILD_ID"
  | "PARENT_NOT_FOUND"
  | "PARENT_NOT_ACTIVE"
  | "CHILD_NOT_FOUND"
  | "CHILD_NOT_OWNED"
  | "INTERNAL_ERROR";

export type ChildPetListItem = {
  id: string;
  childId: string;
  petId: string;
  customName: string | null;
  unlockedAt: string;
  pet: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string;
    animationUrl: string | null;
    unlockStarCost: number;
    status: string;
    deletedAt: string | null;
  };
};

function normalizeUuid<T extends ListChildPetsErrorType>(
  value: string,
  missingType: T,
  invalidType: T,
  label: string,
): string {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new AppError<ListChildPetsErrorType>(missingType, `${label} is required.`, 400);
  }

  if (!isValidUuid(normalizedValue)) {
    throw new AppError<ListChildPetsErrorType>(invalidType, `Invalid ${label} format.`, 400);
  }

  return normalizedValue;
}

export async function listChildPets(
  parentId: string,
  childId: string,
): Promise<ChildPetListItem[]> {
  const normalizedParentId = normalizeUuid(
    parentId,
    "MISSING_PARENT_ID",
    "INVALID_PARENT_ID",
    "parent ID",
  );
  const normalizedChildId = normalizeUuid(
    childId,
    "MISSING_CHILD_ID",
    "INVALID_CHILD_ID",
    "child ID",
  );

  try {
    const parent = await getUserById(db, normalizedParentId);

    if (!parent || parent.role !== "PARENT") {
      throw new AppError<ListChildPetsErrorType>(
        "PARENT_NOT_FOUND",
        "Parent account not found.",
        404,
      );
    }

    if (parent.status !== "ACTIVE") {
      throw new AppError<ListChildPetsErrorType>(
        "PARENT_NOT_ACTIVE",
        "Parent account is not active.",
        403,
      );
    }

    const child = await getChildProfileById(db, normalizedChildId);

    if (!child) {
      throw new AppError<ListChildPetsErrorType>(
        "CHILD_NOT_FOUND",
        "Child profile not found.",
        404,
      );
    }

    if (child.parentId !== normalizedParentId) {
      throw new AppError<ListChildPetsErrorType>(
        "CHILD_NOT_OWNED",
        "Child profile is not owned by the authenticated parent.",
        403,
      );
    }

    const childPets = await getChildPetsByChildId(db, normalizedChildId);

    return childPets.map((childPet) => ({
      id: childPet.id,
      childId: childPet.childId,
      petId: childPet.petId,
      customName: childPet.customName ?? null,
      unlockedAt: childPet.unlockedAt,
      pet: {
        id: childPet.pet.id,
        name: childPet.pet.name,
        description: childPet.pet.description ?? null,
        imageUrl: childPet.pet.imageUrl,
        animationUrl: childPet.pet.animationUrl ?? null,
        unlockStarCost: childPet.pet.unlockStarCost,
        status: childPet.pet.status,
        deletedAt: childPet.pet.deletedAt ?? null,
      },
    }));
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("[ERROR] Unexpected error in use case: List child pets", error);
    throw new AppError<ListChildPetsErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
