import type { PreferencesMetadata } from "../../db/schema.ts";
import { db } from "../../db/client.ts";
import {
  getPreferencesByChildId,
  updatePreferencesData,
} from "../../db/queries/child_profile_queries.ts";
import { AppError } from "../app_error.ts";
import {
  normalizeUseCaseUuid,
  requireOwnedActiveParentChild,
  type ParentChildAccessErrorType,
} from "../parent_child_access.ts";
import {
  normalizePreferenceSettingsInput,
  toPreferenceSettingsMetadata,
  toPreferenceSettingsResponse,
  type PreferenceSettingsResponse,
} from "./preference_settings.ts";

export type UpdateChildPreferencesErrorType =
  | ParentChildAccessErrorType
  | "MISSING_UPDATE_FIELDS"
  | "INVALID_IS_HIGH_CONTRAST"
  | "INVALID_PREFERENCES"
  | "PREFERENCES_NOT_FOUND"
  | "INTERNAL_ERROR";

export type UpdateChildPreferencesInput = {
  parentId: string;
  childId: string;
  isHighContrast?: boolean;
  preferences?: unknown;
};

export type UpdateChildPreferencesResult = {
  childId: string;
  isHighContrast: boolean;
  preferences: PreferenceSettingsResponse;
  createdAt: string;
  updatedAt: string;
};

function normalizeHighContrast(isHighContrast: boolean | undefined): boolean | undefined {
  if (isHighContrast === undefined) return undefined;

  if (typeof isHighContrast !== "boolean") {
    throw new AppError<UpdateChildPreferencesErrorType>(
      "INVALID_IS_HIGH_CONTRAST",
      "is_high_contrast must be a boolean.",
      400,
    );
  }

  return isHighContrast;
}

export async function updateChildPreferences(
  input: UpdateChildPreferencesInput,
): Promise<UpdateChildPreferencesResult> {
  const parentId = normalizeUseCaseUuid(
    input.parentId,
    "MISSING_PARENT_ID",
    "INVALID_PARENT_ID",
    "parent ID",
  );
  const childId = normalizeUseCaseUuid(
    input.childId,
    "MISSING_CHILD_ID",
    "INVALID_CHILD_ID",
    "child ID",
  );
  const isHighContrast = normalizeHighContrast(input.isHighContrast);
  const preferences =
    input.preferences === undefined
      ? undefined
      : normalizePreferenceSettingsInput(input.preferences, "INVALID_PREFERENCES");

  if (isHighContrast === undefined && preferences === undefined) {
    throw new AppError<UpdateChildPreferencesErrorType>(
      "MISSING_UPDATE_FIELDS",
      "At least one preference field is required.",
      400,
    );
  }

  try {
    await requireOwnedActiveParentChild({ parentId, childId });

    const existingPreferences = await getPreferencesByChildId(db, childId);
    if (!existingPreferences) {
      throw new AppError<UpdateChildPreferencesErrorType>(
        "PREFERENCES_NOT_FOUND",
        "Preferences not found for child profile.",
        404,
      );
    }

    const mergedPreferences =
      preferences === undefined
        ? undefined
        : {
            ...toPreferenceSettingsMetadata(existingPreferences.preferencesData),
            ...preferences,
          };

    const updatedPreferences = await updatePreferencesData(db, childId, {
      ...(isHighContrast !== undefined ? { isHighContrast } : {}),
      ...(mergedPreferences !== undefined
        ? { preferencesData: mergedPreferences as PreferencesMetadata }
        : {}),
    });

    return {
      childId: updatedPreferences.childId,
      isHighContrast: updatedPreferences.isHighContrast,
      preferences: toPreferenceSettingsResponse(updatedPreferences.preferencesData),
      createdAt: updatedPreferences.createdAt,
      updatedAt: updatedPreferences.updatedAt,
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("[ERROR] Unexpected error in use case: Update child preferences", error);
    throw new AppError<UpdateChildPreferencesErrorType>(
      "INTERNAL_ERROR",
      "Internal server error.",
      500,
    );
  }
}
