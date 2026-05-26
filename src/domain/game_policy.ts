export type GameOutcomeInput = {
  isCorrect?: boolean | null;
  aiMatchScore?: number | null;
  aiDetectedEmotion?: string | null;
  aiConfidence?: number | null;
};

export function isGameSessionSuccessful(targetEmotion: string, input: GameOutcomeInput): boolean {
  if (input.isCorrect === true) return true;
  if (input.isCorrect === false) return false;

  if (input.aiMatchScore !== undefined && input.aiMatchScore !== null) {
    return input.aiMatchScore >= 0.5;
  }

  if (
    input.aiDetectedEmotion !== undefined &&
    input.aiDetectedEmotion !== null &&
    input.aiConfidence !== undefined &&
    input.aiConfidence !== null
  ) {
    const normalizedDetected = input.aiDetectedEmotion.trim().toUpperCase();
    const normalizedTarget = targetEmotion.trim().toUpperCase();
    return normalizedDetected === normalizedTarget && input.aiConfidence >= 0.5;
  }

  return false;
}
