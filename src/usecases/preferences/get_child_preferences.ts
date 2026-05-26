import { db } from "../../db/client.ts";
import { getPreferencesByChildId } from "../../db/queries/child_profile_queries.ts";
import { AppError } from "../app_error.ts";
import {
  normalizeUseCaseUuid,
  requireOwnedActiveParentChild,
  type ParentChildAccessErrorType,
} from "../parent_child_access.ts";
import {
  toPreferenceSettingsResponse,
  type PreferenceSettingsResponse,
} from "./preference_settings.ts";

export type GetChildPreferencesErrorType =
  | ParentChildAccessErrorType
  | "PREFERENCES_NOT_FOUND"
  | "INTERNAL_ERROR";

export type GetChildPreferencesInput = {
  parentId: string;
  childId: string;
};

export type ChildPreferencesResult = {
  childId: string;
  isHighContrast: boolean;
  preferences: PreferenceSettingsResponse;
  createdAt: string;
  updatedAt: string;
};

export async function getChildPreferences(
  input: GetChildPreferencesInput,
): Promise<ChildPreferencesResult> {
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

  try {
    await requireOwnedActiveParentChild({ parentId, childId });

    const preferences = await getPreferencesByChildId(db, childId);
    if (!preferences) {
      throw new AppError<GetChildPreferencesErrorType>(
        "PREFERENCES_NOT_FOUND",
        "Preferences not found for child profile.",
        404,
      );
    }

    return {
      childId: preferences.childId,
      isHighContrast: preferences.isHighContrast,
      preferences: toPreferenceSettingsResponse(preferences.preferencesData),
      createdAt: preferences.createdAt,
      updatedAt: preferences.updatedAt,
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("[ERROR] Unexpected error in use case: Get child preferences", error);
    throw new AppError<GetChildPreferencesErrorType>(
      "INTERNAL_ERROR",
      "Internal server error.",
      500,
    );
  }
}
