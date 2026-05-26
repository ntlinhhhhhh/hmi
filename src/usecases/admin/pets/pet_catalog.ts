import { isValidUuid } from "../../../utils/validation.ts";
import { AppError } from "../../app_error.ts";

export type AdminPetStatus = "ACTIVE" | "HIDDEN";

export type PetCatalogRow = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  animationUrl: string | null;
  unlockStarCost: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type PetCatalogResult = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  animationUrl: string | null;
  unlockStarCost: number;
  status: AdminPetStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export function toPetCatalogResult(pet: PetCatalogRow): PetCatalogResult {
  return {
    id: pet.id,
    name: pet.name,
    description: pet.description ?? null,
    imageUrl: pet.imageUrl,
    animationUrl: pet.animationUrl ?? null,
    unlockStarCost: pet.unlockStarCost,
    status: pet.status === "HIDDEN" ? "HIDDEN" : "ACTIVE",
    createdAt: pet.createdAt,
    updatedAt: pet.updatedAt,
    deletedAt: pet.deletedAt ?? null,
  };
}

export function normalizePetId<T extends string>(petId: string, errorType: T): string {
  const value = petId.trim();

  if (!value || !isValidUuid(value)) {
    throw new AppError<T>(errorType, "Invalid pet ID format.", 400);
  }

  return value;
}

export function normalizePetStatus<T extends string>(
  status: string | undefined,
  errorType: T,
): AdminPetStatus | undefined {
  if (status === undefined || status.trim() === "") return undefined;

  const value = status.trim().toUpperCase();
  if (value !== "ACTIVE" && value !== "HIDDEN") {
    throw new AppError<T>(errorType, "Pet status must be ACTIVE or HIDDEN.", 400);
  }

  return value;
}

export function normalizePetName<T extends string>(name: string | undefined, errorType: T): string {
  const value = name?.trim().replace(/\s+/g, " ") ?? "";

  if (!value || value.length > 80) {
    throw new AppError<T>(
      errorType,
      "Pet name is required and must be 80 characters or fewer.",
      400,
    );
  }

  return value;
}

export function normalizeOptionalText<T extends string>(
  value: string | null | undefined,
  errorType: T,
  fieldName: string,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalizedValue = value.trim().replace(/\s+/g, " ");
  if (!normalizedValue) return null;

  if (normalizedValue.length > maxLength) {
    throw new AppError<T>(errorType, `${fieldName} must be ${maxLength} characters or fewer.`, 400);
  }

  return normalizedValue;
}

export function normalizeRequiredUrl<T extends string>(
  value: string | undefined,
  errorType: T,
  fieldName: string,
): string {
  const normalizedValue = value?.trim() ?? "";

  if (
    !normalizedValue ||
    normalizedValue.length > 2048 ||
    /[\u0000-\u001f\u007f]/.test(normalizedValue)
  ) {
    throw new AppError<T>(
      errorType,
      `${fieldName} is required, must be 2048 characters or fewer, and cannot contain control characters.`,
      400,
    );
  }

  return normalizedValue;
}

export function normalizeOptionalUrl<T extends string>(
  value: string | null | undefined,
  errorType: T,
  fieldName: string,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalizedValue = value.trim();
  if (!normalizedValue) return null;

  if (normalizedValue.length > 2048 || /[\u0000-\u001f\u007f]/.test(normalizedValue)) {
    throw new AppError<T>(
      errorType,
      `${fieldName} must be 2048 characters or fewer and cannot contain control characters.`,
      400,
    );
  }

  return normalizedValue;
}

export function normalizeStarCost<T extends string>(
  value: number | undefined,
  errorType: T,
): number {
  if (value === undefined || !Number.isInteger(value) || value < 0) {
    throw new AppError<T>(errorType, "unlock_star_cost must be a non-negative integer.", 400);
  }

  return value;
}
