export const LECTURE_COMPLETION_REWARD_STARS = 1;
export const QUIZ_CORRECT_REWARD_STARS = 2;
export const AI_GAME_SUCCESS_REWARD_STARS = 3;

export type ContentRewardKind = "LECTURE_COMPLETION" | "QUIZ_CORRECT" | "AI_GAME_SUCCESS";

const rewardStarsByKind = {
  LECTURE_COMPLETION: LECTURE_COMPLETION_REWARD_STARS,
  QUIZ_CORRECT: QUIZ_CORRECT_REWARD_STARS,
  AI_GAME_SUCCESS: AI_GAME_SUCCESS_REWARD_STARS,
} satisfies Record<ContentRewardKind, number>;

export const MAX_CONTENT_COMPLETION_REWARD_STARS = AI_GAME_SUCCESS_REWARD_STARS;

export function getContentRewardStars(kind: ContentRewardKind): number {
  return rewardStarsByKind[kind];
}
