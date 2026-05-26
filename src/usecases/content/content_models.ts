export type ContentType = "LECTURE" | "QUIZ" | "GAME";
export type ContentStatus = "DRAFT" | "PUBLISHED";
export type GamePromptAssetType = "ICON" | "IMAGE" | "VIDEO";

export type ContentRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  lecture: {
    id: string;
    mediaUrl: string | null;
    description: string | null;
    difficultyLevel: number;
    isDefault: boolean;
  } | null;
  quiz: {
    id: string;
    mediaUrl: string | null;
    description: string | null;
    difficultyLevel: number;
    isDefault: boolean;
    answerEmotions: string[];
    correctEmotion: string;
  } | null;
  game: {
    id: string;
    targetEmotion: string;
    timeLimitSeconds: number;
    difficultyLevel: number;
    isDefault: boolean;
    unlockStarCost: number;
    promptAssetType: string | null;
    promptAssetUrl: string | null;
  } | null;
};

export type ContentProgressSummary = {
  totalSessions: number;
  completedSessions: number;
  starsEarned: number;
  lastSessionAt: string | null;
};

export type ContentResult = {
  id: string;
  title: string;
  type: ContentType;
  status: ContentStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  difficultyLevel: number | null;
  unlockStarCost: number;
  lecture: {
    mediaUrl: string | null;
    description: string | null;
    difficultyLevel: number;
    isDefault: boolean;
  } | null;
  quiz: {
    mediaUrl: string | null;
    description: string | null;
    difficultyLevel: number;
    isDefault: boolean;
    answerEmotions: string[];
    correctEmotion: string;
  } | null;
  game: {
    targetEmotion: string;
    timeLimitSeconds: number;
    difficultyLevel: number;
    isDefault: boolean;
    unlockStarCost: number;
    promptAssetType: GamePromptAssetType | null;
    promptAssetUrl: string | null;
  } | null;
  isUnlocked: boolean | null;
  unlock: {
    id: string;
    unlockedAt: string;
  } | null;
  progress: ContentProgressSummary | null;
};

export function isContentType(value: string): value is ContentType {
  return value === "LECTURE" || value === "QUIZ" || value === "GAME";
}

function isContentStatus(value: string): value is ContentStatus {
  return value === "DRAFT" || value === "PUBLISHED";
}

function normalizeGamePromptAssetType(value: string | null): GamePromptAssetType | null {
  if (value === "ICON" || value === "IMAGE" || value === "VIDEO") return value;
  return null;
}

export function getContentDifficultyLevel(content: ContentRow): number | null {
  if (content.type === "LECTURE") return content.lecture?.difficultyLevel ?? null;
  if (content.type === "QUIZ") return content.quiz?.difficultyLevel ?? null;
  if (content.type === "GAME") return content.game?.difficultyLevel ?? null;
  return null;
}

export function getContentUnlockStarCost(content: ContentRow): number {
  if (content.type === "GAME") return content.game?.unlockStarCost ?? 0;
  return 0;
}

export function toContentResult(
  content: ContentRow,
  state: {
    unlock?: { id: string; unlockedAt: string } | null;
    progress?: ContentProgressSummary | null;
  } = {},
): ContentResult {
  const type = isContentType(content.type) ? content.type : "LECTURE";
  const status = isContentStatus(content.status) ? content.status : "DRAFT";
  const unlock = state.unlock ?? null;

  return {
    id: content.id,
    title: content.title,
    type,
    status,
    createdBy: content.createdBy,
    createdAt: content.createdAt,
    updatedAt: content.updatedAt,
    deletedAt: content.deletedAt,
    difficultyLevel: getContentDifficultyLevel(content),
    unlockStarCost: getContentUnlockStarCost(content),
    lecture: content.lecture
      ? {
          mediaUrl: content.lecture.mediaUrl ?? null,
          description: content.lecture.description ?? null,
          difficultyLevel: content.lecture.difficultyLevel,
          isDefault: content.lecture.isDefault,
        }
      : null,
    quiz: content.quiz
      ? {
          mediaUrl: content.quiz.mediaUrl ?? null,
          description: content.quiz.description ?? null,
          difficultyLevel: content.quiz.difficultyLevel,
          isDefault: content.quiz.isDefault,
          answerEmotions: content.quiz.answerEmotions,
          correctEmotion: content.quiz.correctEmotion,
        }
      : null,
    game: content.game
      ? {
          targetEmotion: content.game.targetEmotion,
          timeLimitSeconds: content.game.timeLimitSeconds,
          difficultyLevel: content.game.difficultyLevel,
          isDefault: content.game.isDefault,
          unlockStarCost: content.game.unlockStarCost,
          promptAssetType: normalizeGamePromptAssetType(content.game.promptAssetType),
          promptAssetUrl: content.game.promptAssetUrl,
        }
      : null,
    isUnlocked: state.unlock === undefined ? null : unlock !== null,
    unlock,
    progress: state.progress ?? null,
  };
}
