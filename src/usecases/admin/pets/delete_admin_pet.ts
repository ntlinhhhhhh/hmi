import { db } from "../../../db/client.ts";
import { getAdminStorePetById, softDeleteStorePet } from "../../../db/queries/store_queries.ts";
import { AppError } from "../../app_error.ts";
import {
  normalizeAdminId,
  requireActiveAdmin,
  type AdminAuthorizationErrorType,
} from "../admin_authorization.ts";
import { normalizePetId } from "./pet_catalog.ts";

export type DeleteAdminPetErrorType =
  | AdminAuthorizationErrorType
  | "INVALID_PET_ID"
  | "MISSING_CONFIRMATION"
  | "INVALID_CONFIRMATION"
  | "PET_NOT_FOUND"
  | "INTERNAL_ERROR";

export type DeleteAdminPetInput = {
  adminId: string;
  petId: string;
  confirmation?: string;
};

function normalizeConfirmation(confirmation: string | undefined): void {
  if (confirmation === undefined || confirmation.trim() === "") {
    throw new AppError<DeleteAdminPetErrorType>(
      "MISSING_CONFIRMATION",
      "Delete confirmation is required.",
      400,
    );
  }

  if (confirmation !== "DELETE") {
    throw new AppError<DeleteAdminPetErrorType>(
      "INVALID_CONFIRMATION",
      "Delete confirmation must be DELETE.",
      400,
    );
  }
}

export async function deleteAdminPet(input: DeleteAdminPetInput): Promise<void> {
  const adminId = normalizeAdminId(input.adminId);
  const petId = normalizePetId(input.petId, "INVALID_PET_ID");
  normalizeConfirmation(input.confirmation);

  try {
    await requireActiveAdmin(adminId);

    const existingPet = await getAdminStorePetById(db, petId);
    if (!existingPet) {
      throw new AppError<DeleteAdminPetErrorType>(
        "PET_NOT_FOUND",
        "Pet catalog item not found.",
        404,
      );
    }

    await softDeleteStorePet(db, petId);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("[ERROR] Unexpected error in use case: Delete admin pet", error);
    throw new AppError<DeleteAdminPetErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
