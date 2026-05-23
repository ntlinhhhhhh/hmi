import { Elysia, t } from "elysia";
import { getContentDetail } from "../usecases/content/get_content_detail.ts";
import { listChildContents } from "../usecases/content/list_child_contents.ts";
import { unlockChildContent } from "../usecases/content/unlock_child_content.ts";
import type { ContentResult } from "../usecases/content/content_models.ts";
import { AppError } from "../usecases/app_error.ts";
import { withApiErrorHandler } from "./api_error_handler.ts";
import { requireAuth } from "./middleware/require_auth.ts";

function parseOptionalNumber(rawValue: string | undefined): number | undefined {
  if (rawValue === undefined || rawValue.trim() === "") return undefined;
  return Number(rawValue);
}

function parseOptionalBoolean(rawValue: string | undefined): boolean | undefined {
  if (rawValue === undefined || rawValue.trim() === "") return undefined;

  const normalizedValue = rawValue.trim().toLowerCase();
  if (normalizedValue === "true") return true;
  if (normalizedValue === "false") return false;

  throw new AppError<"INVALID_INCLUDE_LOCKED">(
    "INVALID_INCLUDE_LOCKED",
    "include_locked must be true or false.",
    400,
  );
}

function formatContent(content: ContentResult) {
  return {
    id: content.id,
    title: content.title,
    type: content.type,
    status: content.status,
    created_by: content.createdBy,
    created_at: content.createdAt,
    updated_at: content.updatedAt,
    deleted_at: content.deletedAt,
    difficulty_level: content.difficultyLevel,
    unlock_star_cost: content.unlockStarCost,
    is_unlocked: content.isUnlocked,
    unlock: content.unlock
      ? {
          id: content.unlock.id,
          unlocked_at: content.unlock.unlockedAt,
        }
      : null,
    progress: content.progress
      ? {
          total_sessions: content.progress.totalSessions,
          completed_sessions: content.progress.completedSessions,
          stars_earned: content.progress.starsEarned,
          last_session_at: content.progress.lastSessionAt,
        }
      : null,
    lecture: content.lecture
      ? {
          media_url: content.lecture.mediaUrl,
          description: content.lecture.description,
          difficulty_level: content.lecture.difficultyLevel,
          is_default: content.lecture.isDefault,
        }
      : null,
    quiz: content.quiz
      ? {
          media_url: content.quiz.mediaUrl,
          description: content.quiz.description,
          difficulty_level: content.quiz.difficultyLevel,
          is_default: content.quiz.isDefault,
          answer_emotions: content.quiz.answerEmotions,
          correct_emotion: content.quiz.correctEmotion,
        }
      : null,
    game: content.game
      ? {
          target_emotion: content.game.targetEmotion,
          time_limit_seconds: content.game.timeLimitSeconds,
          difficulty_level: content.game.difficultyLevel,
          is_default: content.game.isDefault,
          unlock_star_cost: content.game.unlockStarCost,
        }
      : null,
  };
}

const protectedContentRouter = new Elysia()
  .use(requireAuth)
  .get(
    "/children/:childId/contents",
    async ({ authUserId, params, query, set }) => {
      const contents = await listChildContents({
        parentId: authUserId,
        childId: params.childId,
        type: query.type,
        difficultyLevel: parseOptionalNumber(query.difficulty_level),
        includeLocked: parseOptionalBoolean(query.include_locked),
      });

      set.status = 200;
      return {
        contents: contents.map(formatContent),
      };
    },
    {
      params: t.Object({
        childId: t.String(),
      }),
      query: t.Object({
        type: t.Optional(t.String()),
        difficulty_level: t.Optional(t.String()),
        include_locked: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/contents/:contentId",
    async ({ authUserId, params, query, set }) => {
      const content = await getContentDetail({
        userId: authUserId,
        contentId: params.contentId,
        childId: query.child_id,
      });

      set.status = 200;
      return {
        content: formatContent(content),
      };
    },
    {
      params: t.Object({
        contentId: t.String(),
      }),
      query: t.Object({
        child_id: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/children/:childId/contents/:contentId/unlock",
    async ({ authUserId, params, set }) => {
      const result = await unlockChildContent({
        parentId: authUserId,
        childId: params.childId,
        contentId: params.contentId,
      });

      set.status = 201;
      return {
        message: "Content unlocked successfully.",
        child_total_stars: result.childTotalStars,
        unlock: {
          id: result.unlock.id,
          child_id: result.unlock.childId,
          content_id: result.unlock.contentId,
          unlocked_at: result.unlock.unlockedAt,
        },
      };
    },
    {
      params: t.Object({
        childId: t.String(),
        contentId: t.String(),
      }),
    },
  );

const contentRouter = withApiErrorHandler(new Elysia(), {
  validationErrorType: "INVALID_JSON",
}).use(protectedContentRouter);

export default contentRouter;
