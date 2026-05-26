export type InternalEmotionValue =
  | "HAPPY"
  | "SAD"
  | "ANGRY"
  | "STRESSED"
  | "CALM"
  | "NEUTRAL"
  | "SCARED"
  | "SURPRISED";

export type ExternalAiEmotionLabel = "happy" | "sad" | "angry" | "fear" | "neutral";

const internalEmotionValues = [
  "HAPPY",
  "SAD",
  "ANGRY",
  "STRESSED",
  "CALM",
  "NEUTRAL",
  "SCARED",
  "SURPRISED",
] as const satisfies readonly InternalEmotionValue[];

const externalAiEmotionLabels = [
  "happy",
  "sad",
  "angry",
  "fear",
  "neutral",
] as const satisfies readonly ExternalAiEmotionLabel[];

export const VALID_EMOTIONS = new Set<string>(internalEmotionValues);
export const VALID_AI_EMOTION_LABELS = new Set<string>(externalAiEmotionLabels);

const aiLabelToInternalEmotion = {
  happy: "HAPPY",
  sad: "SAD",
  angry: "ANGRY",
  fear: "SCARED",
  neutral: "NEUTRAL",
} satisfies Record<ExternalAiEmotionLabel, InternalEmotionValue>;

const internalEmotionToAiLabel: Partial<Record<InternalEmotionValue, ExternalAiEmotionLabel>> = {
  HAPPY: "happy",
  SAD: "sad",
  ANGRY: "angry",
  SCARED: "fear",
  NEUTRAL: "neutral",
};

export function normalizeInternalEmotionValue(value: string): InternalEmotionValue | null {
  const normalizedValue = value.trim().toUpperCase();
  return VALID_EMOTIONS.has(normalizedValue) ? (normalizedValue as InternalEmotionValue) : null;
}

export function normalizeExternalAiEmotionLabel(value: string): ExternalAiEmotionLabel | null {
  const normalizedValue = value.trim().toLowerCase();
  return VALID_AI_EMOTION_LABELS.has(normalizedValue)
    ? (normalizedValue as ExternalAiEmotionLabel)
    : null;
}

export function mapEmotionInputToInternal(value: string): InternalEmotionValue | null {
  const internalEmotion = normalizeInternalEmotionValue(value);
  if (internalEmotion) return internalEmotion;

  const aiLabel = normalizeExternalAiEmotionLabel(value);
  return aiLabel ? aiLabelToInternalEmotion[aiLabel] : null;
}

export function mapEmotionInputToAiLabel(value: string): ExternalAiEmotionLabel | null {
  const aiLabel = normalizeExternalAiEmotionLabel(value);
  if (aiLabel) return aiLabel;

  const internalEmotion = normalizeInternalEmotionValue(value);
  return internalEmotion ? (internalEmotionToAiLabel[internalEmotion] ?? null) : null;
}
