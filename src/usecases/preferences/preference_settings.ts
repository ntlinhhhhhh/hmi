import type { PreferencesMetadata } from "../../db/schema.ts";
import { AppError } from "../app_error.ts";

export type PreferenceSettingsResponse = {
  theme?: string;
  music_track_id?: string | null;
  music_volume?: number;
  voice_prompt_enabled?: boolean;
  high_contrast_enabled?: boolean;
  reduced_motion_enabled?: boolean;
  brightness_level?: number;
  timeout_seconds?: number;
  calming_story_enabled?: boolean;
};

const allowedPreferenceKeys = new Set([
  "theme",
  "music_track_id",
  "music_volume",
  "voice_prompt_enabled",
  "high_contrast_enabled",
  "reduced_motion_enabled",
  "brightness_level",
  "timeout_seconds",
  "calming_story_enabled",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function throwInvalid<T extends string>(errorType: T, message: string): never {
  throw new AppError<T>(errorType, message, 400);
}

function normalizeBoundedSlug<T extends string>(
  value: unknown,
  errorType: T,
  fieldName: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throwInvalid(errorType, `${fieldName} must be a string.`);
  }

  const normalizedValue = value.trim().toLowerCase();

  if (
    !normalizedValue ||
    normalizedValue.length > maxLength ||
    !/^[a-z0-9][a-z0-9_-]*$/.test(normalizedValue)
  ) {
    throwInvalid(
      errorType,
      `${fieldName} must be a non-empty slug of ${maxLength} characters or fewer.`,
    );
  }

  return normalizedValue;
}

function normalizeOptionalTrackId<T extends string>(value: unknown, errorType: T): string | null {
  if (value === null) return null;

  if (typeof value !== "string") {
    throwInvalid(errorType, "music_track_id must be a string or null.");
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) return null;

  if (normalizedValue.length > 120 || /[\u0000-\u001f\u007f]/.test(normalizedValue)) {
    throwInvalid(
      errorType,
      "music_track_id must be 120 characters or fewer and cannot contain control characters.",
    );
  }

  return normalizedValue;
}

function normalizeIntegerRange<T extends string>(
  value: unknown,
  errorType: T,
  fieldName: string,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throwInvalid(errorType, `${fieldName} must be an integer from ${min} to ${max}.`);
  }

  return value;
}

function normalizeBoolean<T extends string>(
  value: unknown,
  errorType: T,
  fieldName: string,
): boolean {
  if (typeof value !== "boolean") {
    throwInvalid(errorType, `${fieldName} must be a boolean.`);
  }

  return value;
}

export function normalizePreferenceSettingsInput<T extends string>(
  input: unknown,
  errorType: T,
): PreferencesMetadata {
  if (!isRecord(input)) {
    throwInvalid(errorType, "preferences must be an object.");
  }

  for (const key of Object.keys(input)) {
    if (!allowedPreferenceKeys.has(key)) {
      throwInvalid(errorType, `Unsupported preference key: ${key}.`);
    }
  }

  const settings: PreferencesMetadata = {};

  if ("theme" in input && input.theme !== undefined) {
    settings.theme = normalizeBoundedSlug(input.theme, errorType, "theme", 32);
  }

  if ("music_track_id" in input && input.music_track_id !== undefined) {
    settings.musicTrackId = normalizeOptionalTrackId(input.music_track_id, errorType);
  }

  if ("music_volume" in input && input.music_volume !== undefined) {
    settings.musicVolume = normalizeIntegerRange(
      input.music_volume,
      errorType,
      "music_volume",
      0,
      100,
    );
  }

  if ("voice_prompt_enabled" in input && input.voice_prompt_enabled !== undefined) {
    settings.voicePromptEnabled = normalizeBoolean(
      input.voice_prompt_enabled,
      errorType,
      "voice_prompt_enabled",
    );
  }

  if ("high_contrast_enabled" in input && input.high_contrast_enabled !== undefined) {
    settings.highContrastEnabled = normalizeBoolean(
      input.high_contrast_enabled,
      errorType,
      "high_contrast_enabled",
    );
  }

  if ("reduced_motion_enabled" in input && input.reduced_motion_enabled !== undefined) {
    settings.reducedMotionEnabled = normalizeBoolean(
      input.reduced_motion_enabled,
      errorType,
      "reduced_motion_enabled",
    );
  }

  if ("brightness_level" in input && input.brightness_level !== undefined) {
    settings.brightnessLevel = normalizeIntegerRange(
      input.brightness_level,
      errorType,
      "brightness_level",
      0,
      100,
    );
  }

  if ("timeout_seconds" in input && input.timeout_seconds !== undefined) {
    settings.timeoutSeconds = normalizeIntegerRange(
      input.timeout_seconds,
      errorType,
      "timeout_seconds",
      1,
      3600,
    );
  }

  if ("calming_story_enabled" in input && input.calming_story_enabled !== undefined) {
    settings.calmingStoryEnabled = normalizeBoolean(
      input.calming_story_enabled,
      errorType,
      "calming_story_enabled",
    );
  }

  return settings;
}

function readString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;

  const normalizedValue = value.trim();
  if (!normalizedValue || normalizedValue.length > maxLength) return undefined;

  return normalizedValue;
}

function readIntegerRange(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    return undefined;
  }

  return value;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function getStoredValue(
  record: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
): unknown {
  if (camelKey in record) return record[camelKey];
  return record[snakeKey];
}

export function toPreferenceSettingsMetadata(
  settings: PreferencesMetadata | unknown | null | undefined,
): PreferencesMetadata {
  if (!isRecord(settings)) return {};

  const metadata: PreferencesMetadata = {};
  const theme = readString(getStoredValue(settings, "theme", "theme"), 32);
  const musicTrackId = getStoredValue(settings, "musicTrackId", "music_track_id");
  const musicVolume = readIntegerRange(
    getStoredValue(settings, "musicVolume", "music_volume"),
    0,
    100,
  );
  const voicePromptEnabled = readBoolean(
    getStoredValue(settings, "voicePromptEnabled", "voice_prompt_enabled"),
  );
  const highContrastEnabled = readBoolean(
    getStoredValue(settings, "highContrastEnabled", "high_contrast_enabled"),
  );
  const reducedMotionEnabled = readBoolean(
    getStoredValue(settings, "reducedMotionEnabled", "reduced_motion_enabled"),
  );
  const brightnessLevel = readIntegerRange(
    getStoredValue(settings, "brightnessLevel", "brightness_level"),
    0,
    100,
  );
  const timeoutSeconds = readIntegerRange(
    getStoredValue(settings, "timeoutSeconds", "timeout_seconds"),
    1,
    3600,
  );
  const calmingStoryEnabled = readBoolean(
    getStoredValue(settings, "calmingStoryEnabled", "calming_story_enabled"),
  );

  if (theme !== undefined) metadata.theme = theme;
  if (musicTrackId === null) {
    metadata.musicTrackId = null;
  } else {
    const normalizedTrackId = readString(musicTrackId, 120);
    if (normalizedTrackId !== undefined) metadata.musicTrackId = normalizedTrackId;
  }
  if (musicVolume !== undefined) metadata.musicVolume = musicVolume;
  if (voicePromptEnabled !== undefined) metadata.voicePromptEnabled = voicePromptEnabled;
  if (highContrastEnabled !== undefined) metadata.highContrastEnabled = highContrastEnabled;
  if (reducedMotionEnabled !== undefined) metadata.reducedMotionEnabled = reducedMotionEnabled;
  if (brightnessLevel !== undefined) metadata.brightnessLevel = brightnessLevel;
  if (timeoutSeconds !== undefined) metadata.timeoutSeconds = timeoutSeconds;
  if (calmingStoryEnabled !== undefined) metadata.calmingStoryEnabled = calmingStoryEnabled;

  return metadata;
}

export function toPreferenceSettingsResponse(
  settings: PreferencesMetadata | unknown | null | undefined,
): PreferenceSettingsResponse {
  const metadata = toPreferenceSettingsMetadata(settings);
  const response: PreferenceSettingsResponse = {};

  if (metadata.theme !== undefined) response.theme = metadata.theme;
  if (metadata.musicTrackId === null) {
    response.music_track_id = null;
  } else if (metadata.musicTrackId !== undefined) {
    response.music_track_id = metadata.musicTrackId;
  }
  if (metadata.musicVolume !== undefined) response.music_volume = metadata.musicVolume;
  if (metadata.voicePromptEnabled !== undefined) {
    response.voice_prompt_enabled = metadata.voicePromptEnabled;
  }
  if (metadata.highContrastEnabled !== undefined) {
    response.high_contrast_enabled = metadata.highContrastEnabled;
  }
  if (metadata.reducedMotionEnabled !== undefined) {
    response.reduced_motion_enabled = metadata.reducedMotionEnabled;
  }
  if (metadata.brightnessLevel !== undefined) response.brightness_level = metadata.brightnessLevel;
  if (metadata.timeoutSeconds !== undefined) response.timeout_seconds = metadata.timeoutSeconds;
  if (metadata.calmingStoryEnabled !== undefined) {
    response.calming_story_enabled = metadata.calmingStoryEnabled;
  }

  return response;
}
