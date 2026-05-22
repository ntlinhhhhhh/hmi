import { db, withTx } from "../../db/client.ts";
import { getChildProfileById } from "../../db/queries/child_profile_queries.ts";
import { buyPetTx, getActiveStorePetById } from "../../db/queries/store_queries.ts";
import { getUserById } from "../../db/queries/user_queries.ts";
import { isValidUuid } from "../../utils/validation.ts";
import { AppError } from "../app_error.ts";
import { getPgConstraintName, isPgErrorCode, PgErrorCode } from "../postgres_error.ts";

export type BuyPetErrorType =
  | "MISSING_PARENT_ID"
  | "INVALID_PARENT_ID"
  | "MISSING_CHILD_ID"
  | "INVALID_CHILD_ID"
  | "MISSING_PET_ID"
  | "INVALID_PET_ID"
  | "PARENT_NOT_FOUND"
  | "PARENT_NOT_ACTIVE"
  | "CHILD_NOT_FOUND"
  | "CHILD_NOT_OWNED"
  | "PET_NOT_FOUND"
  | "INVALID_CUSTOM_NAME"
  | "INSUFFICIENT_STARS"
  | "PET_ALREADY_OWNED"
  | "INTERNAL_ERROR";

export type BuyPetInput = {
  parentId: string;
  childId: string;
  petId: string;
  customName?: string;
};

export type BuyPetResult = {
  childTotalStars: number;
  childPet: {
    id: string;
    childId: string;
    petId: string;
    customName: string | null;
    unlockedAt: string;
  };
};

function normalizeUuid<T extends BuyPetErrorType>(
  value: string,
  missingType: T,
  invalidType: T,
  label: string,
): string {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new AppError<BuyPetErrorType>(missingType, `${label} is required.`, 400);
  }

  if (!isValidUuid(normalizedValue)) {
    throw new AppError<BuyPetErrorType>(invalidType, `Invalid ${label} format.`, 400);
  }

  return normalizedValue;
}

function normalizeCustomName(customName: string | undefined): string | undefined {
  if (customName === undefined) return undefined;

  const value = customName.trim().replace(/\s+/g, " ");
  if (!value) return undefined;

  if (value.length > 80) {
    throw new AppError<BuyPetErrorType>(
      "INVALID_CUSTOM_NAME",
      "Custom pet name must be 80 characters or fewer.",
      400,
    );
  }

  return value;
}

function mapPurchaseWriteError(error: unknown): AppError<BuyPetErrorType> | null {
  if (isPgErrorCode(error, PgErrorCode.UNIQUE_VIOLATION)) {
    const constraint = getPgConstraintName(error);
    if (constraint === "child_pets_unique_pair") {
      return new AppError<BuyPetErrorType>(
        "PET_ALREADY_OWNED",
        "Child already owns this pet.",
        409,
      );
    }
  }

  if (isPgErrorCode(error, PgErrorCode.FOREIGN_KEY_VIOLATION)) {
    const constraint = getPgConstraintName(error);
    if (constraint === "child_pets_child_id_fkey") {
      return new AppError<BuyPetErrorType>("CHILD_NOT_FOUND", "Child profile not found.", 404);
    }

    if (constraint === "child_pets_pet_id_fkey") {
      return new AppError<BuyPetErrorType>("PET_NOT_FOUND", "Pet not found.", 404);
    }
  }

  return null;
}

export async function buyPet(input: BuyPetInput): Promise<BuyPetResult> {
  const parentId = normalizeUuid(
    input.parentId,
    "MISSING_PARENT_ID",
    "INVALID_PARENT_ID",
    "parent ID",
  );
  const childId = normalizeUuid(input.childId, "MISSING_CHILD_ID", "INVALID_CHILD_ID", "child ID");
  const petId = normalizeUuid(input.petId, "MISSING_PET_ID", "INVALID_PET_ID", "pet ID");
  const customName = normalizeCustomName(input.customName);

  try {
    const parent = await getUserById(db, parentId);

    if (!parent || parent.role !== "PARENT") {
      throw new AppError<BuyPetErrorType>("PARENT_NOT_FOUND", "Parent account not found.", 404);
    }

    if (parent.status !== "ACTIVE") {
      throw new AppError<BuyPetErrorType>(
        "PARENT_NOT_ACTIVE",
        "Parent account is not active.",
        403,
      );
    }

    const child = await getChildProfileById(db, childId);

    if (!child) {
      throw new AppError<BuyPetErrorType>("CHILD_NOT_FOUND", "Child profile not found.", 404);
    }

    if (child.parentId !== parentId) {
      throw new AppError<BuyPetErrorType>(
        "CHILD_NOT_OWNED",
        "Child profile is not owned by the authenticated parent.",
        403,
      );
    }

    const pet = await getActiveStorePetById(db, petId);

    if (!pet) {
      throw new AppError<BuyPetErrorType>("PET_NOT_FOUND", "Active pet not found.", 404);
    }

    if (child.totalStars < pet.unlockStarCost) {
      throw new AppError<BuyPetErrorType>(
        "INSUFFICIENT_STARS",
        "Child does not have enough stars to buy this pet.",
        409,
      );
    }

    const purchase = await withTx(async (tx) =>
      buyPetTx(tx, childId, petId, pet.unlockStarCost, customName),
    );

    if (!purchase) {
      throw new AppError<BuyPetErrorType>(
        "INSUFFICIENT_STARS",
        "Child does not have enough stars to buy this pet.",
        409,
      );
    }

    return {
      childTotalStars: purchase.childTotalStars,
      childPet: {
        id: purchase.childPet.id,
        childId: purchase.childPet.childId,
        petId: purchase.childPet.petId,
        customName: purchase.childPet.customName ?? null,
        unlockedAt: purchase.childPet.unlockedAt,
      },
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    const mappedError = mapPurchaseWriteError(error);
    if (mappedError) {
      throw mappedError;
    }

    console.error("[ERROR] Unexpected error in use case: Buy pet", error);
    throw new AppError<BuyPetErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
