import { db } from "../../../db/client.ts";
import { getAdminStorePetById, updateStorePet } from "../../../db/queries/store_queries.ts";
import { AppError } from "../../app_error.ts";
import {
  normalizeAdminId,
  requireActiveAdmin,
  type AdminAuthorizationErrorType,
} from "../admin_authorization.ts";
import { isPgErrorCode, PgErrorCode } from "../../postgres_error.ts";
import {
  normalizeOptionalText,
  normalizeOptionalUrl,
  normalizePetId,
  normalizePetName,
  normalizePetStatus,
  normalizeRequiredUrl,
  normalizeStarCost,
  toPetCatalogResult,
  type PetCatalogResult,
} from "./pet_catalog.ts";

export type UpdateAdminPetErrorType =
  | AdminAuthorizationErrorType
  | "INVALID_PET_ID"
  | "PET_NOT_FOUND"
  | "MISSING_UPDATE_FIELDS"
  | "INVALID_NAME"
  | "INVALID_DESCRIPTION"
  | "INVALID_IMAGE_URL"
  | "INVALID_ANIMATION_URL"
  | "INVALID_UNLOCK_STAR_COST"
  | "INVALID_STATUS"
  | "INTERNAL_ERROR";

export type UpdateAdminPetInput = {
  adminId: string;
  petId: string;
  name?: string;
  description?: string | null;
  imageUrl?: string;
  animationUrl?: string | null;
  unlockStarCost?: number;
  status?: string;
};

export async function updateAdminPet(input: UpdateAdminPetInput): Promise<PetCatalogResult> {
  const adminId = normalizeAdminId(input.adminId);
  const petId = normalizePetId(input.petId, "INVALID_PET_ID");
  const name = input.name === undefined ? undefined : normalizePetName(input.name, "INVALID_NAME");
  const description = normalizeOptionalText(
    input.description,
    "INVALID_DESCRIPTION",
    "description",
    500,
  );
  const imageUrl =
    input.imageUrl === undefined
      ? undefined
      : normalizeRequiredUrl(input.imageUrl, "INVALID_IMAGE_URL", "image_url");
  const animationUrl = normalizeOptionalUrl(
    input.animationUrl,
    "INVALID_ANIMATION_URL",
    "animation_url",
  );
  const unlockStarCost =
    input.unlockStarCost === undefined
      ? undefined
      : normalizeStarCost(input.unlockStarCost, "INVALID_UNLOCK_STAR_COST");
  const status = normalizePetStatus(input.status, "INVALID_STATUS");

  if (
    name === undefined &&
    description === undefined &&
    imageUrl === undefined &&
    animationUrl === undefined &&
    unlockStarCost === undefined &&
    status === undefined
  ) {
    throw new AppError<UpdateAdminPetErrorType>(
      "MISSING_UPDATE_FIELDS",
      "At least one pet field is required.",
      400,
    );
  }

  try {
    await requireActiveAdmin(adminId);

    const existingPet = await getAdminStorePetById(db, petId);
    if (!existingPet) {
      throw new AppError<UpdateAdminPetErrorType>(
        "PET_NOT_FOUND",
        "Pet catalog item not found.",
        404,
      );
    }

    const pet = await updateStorePet(db, petId, {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(imageUrl !== undefined ? { imageUrl } : {}),
      ...(animationUrl !== undefined ? { animationUrl } : {}),
      ...(unlockStarCost !== undefined ? { unlockStarCost } : {}),
      ...(status !== undefined ? { status } : {}),
    });

    return toPetCatalogResult(pet);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    if (isPgErrorCode(error, PgErrorCode.CHECK_VIOLATION)) {
      throw new AppError<UpdateAdminPetErrorType>(
        "INVALID_UNLOCK_STAR_COST",
        "Invalid pet catalog values.",
        400,
      );
    }

    console.error("[ERROR] Unexpected error in use case: Update admin pet", error);
    throw new AppError<UpdateAdminPetErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
