export type RegulationAction =
  | "REDUCE_BRIGHTNESS"
  | "PAUSE_ANIMATION"
  | "PLAY_CALMING_AUDIO"
  | "VOICE_PROMPT"
  | "TIMEOUT"
  | "SHOW_STORY"
  | "RESUME";

const regulationActions = [
  "REDUCE_BRIGHTNESS",
  "PAUSE_ANIMATION",
  "PLAY_CALMING_AUDIO",
  "VOICE_PROMPT",
  "TIMEOUT",
  "SHOW_STORY",
  "RESUME",
] as const satisfies readonly RegulationAction[];

export const VALID_REGULATION_ACTIONS = new Set<string>(regulationActions);

export function normalizeRegulationAction(value: string): RegulationAction | null {
  const normalizedValue = value.trim().toUpperCase();
  return VALID_REGULATION_ACTIONS.has(normalizedValue)
    ? (normalizedValue as RegulationAction)
    : null;
}
