import { db } from "../../../db/client.ts";
import { createStorePet } from "../../../db/queries/store_queries.ts";
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
  normalizePetName,
  normalizePetStatus,
  normalizeRequiredUrl,
  normalizeStarCost,
  toPetCatalogResult,
  type PetCatalogResult,
} from "./pet_catalog.ts";

export type CreateAdminPetErrorType =
  | AdminAuthorizationErrorType
  | "INVALID_NAME"
  | "INVALID_DESCRIPTION"
  | "INVALID_IMAGE_URL"
  | "INVALID_ANIMATION_URL"
  | "INVALID_UNLOCK_STAR_COST"
  | "INVALID_STATUS"
  | "INTERNAL_ERROR";

export type CreateAdminPetInput = {
  adminId: string;
  name?: string;
  description?: string | null;
  imageUrl?: string;
  animationUrl?: string | null;
  unlockStarCost?: number;
  status?: string;
};

export async function createAdminPet(input: CreateAdminPetInput): Promise<PetCatalogResult> {
  const adminId = normalizeAdminId(input.adminId);
  const name = normalizePetName(input.name, "INVALID_NAME");
  const description = normalizeOptionalText(
    input.description,
    "INVALID_DESCRIPTION",
    "description",
    500,
  );
  const imageUrl = normalizeRequiredUrl(input.imageUrl, "INVALID_IMAGE_URL", "image_url");
  const animationUrl = normalizeOptionalUrl(
    input.animationUrl,
    "INVALID_ANIMATION_URL",
    "animation_url",
  );
  const unlockStarCost = normalizeStarCost(input.unlockStarCost, "INVALID_UNLOCK_STAR_COST");
  const status = normalizePetStatus(input.status, "INVALID_STATUS") ?? "ACTIVE";

  try {
    await requireActiveAdmin(adminId);

    const pet = await createStorePet(db, {
      name,
      description: description ?? null,
      imageUrl,
      animationUrl: animationUrl ?? null,
      unlockStarCost,
      status,
    });

    return toPetCatalogResult(pet);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    if (isPgErrorCode(error, PgErrorCode.CHECK_VIOLATION)) {
      throw new AppError<CreateAdminPetErrorType>(
        "INVALID_UNLOCK_STAR_COST",
        "Invalid pet catalog values.",
        400,
      );
    }

    console.error("[ERROR] Unexpected error in use case: Create admin pet", error);
    throw new AppError<CreateAdminPetErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
