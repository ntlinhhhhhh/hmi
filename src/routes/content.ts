import { Elysia, t } from "elysia";
import { getContentDetail } from "../usecases/content/get_content_detail.ts";
import { listChildContents } from "../usecases/content/list_child_contents.ts";
import { listChildContentSessions } from "../usecases/content/list_child_content_sessions.ts";
import { listChildStarTransactions } from "../usecases/content/list_child_star_transactions.ts";
import {
  recordContentSession,
  type ContentSessionResult,
} from "../usecases/content/record_content_session.ts";
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
          prompt_asset_type: content.game.promptAssetType,
          prompt_asset_url: content.game.promptAssetUrl,
        }
      : null,
  };
}

interface SessionFormatInput {
  id: string;
  childId: string;
  contentId: string;
  unlockContentId: string;
  durationSeconds: number | null;
  isCorrect: boolean | null;
  starsEarned: number;
  status: string;
  idempotencyKey: string | null;
  startedAt: string | null;
  completedAt: string | null;
  selectedEmotion?: string | null;
  aiMatchScore?: number | null;
  aiDetectedEmotion?: string | null;
  aiConfidence?: number | null;
  aiScores?: Record<string, number> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

function formatContentSession(session: SessionFormatInput) {
  return {
    id: session.id,
    child_id: session.childId,
    content_id: session.contentId,
    unlock_content_id: session.unlockContentId,
    duration_seconds: session.durationSeconds,
    is_correct: session.isCorrect,
    stars_earned: session.starsEarned,
    status: session.status,
    idempotency_key: session.idempotencyKey,
    started_at: session.startedAt,
    completed_at: session.completedAt,
    selected_emotion: session.selectedEmotion ?? null,
    ai_match_score: session.aiMatchScore ?? null,
    ai_detected_emotion: session.aiDetectedEmotion ?? null,
    ai_confidence: session.aiConfidence ?? null,
    ai_scores: session.aiScores ?? null,
    metadata: session.metadata,
    created_at: session.createdAt,
  };
}

const protectedContentRouter = new Elysia()
  .use(requireAuth)
  .get(
    "/children/:childId/content-sessions",
    async ({ authUserId, params, query, set }) => {
      const result = await listChildContentSessions({
        parentId: authUserId,
        childId: params.childId,
        type: query.type,
        status: query.status,
        from: query.from,
        to: query.to,
        cursor: query.cursor,
        limit: parseOptionalNumber(query.limit),
      });

      set.status = 200;
      return {
        sessions: result.sessions.map(formatContentSession),
        next_cursor: result.nextCursor,
      };
    },
    {
      params: t.Object({
        childId: t.String(),
      }),
      query: t.Object({
        type: t.Optional(t.String()),
        status: t.Optional(t.String()),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/children/:childId/star-transactions",
    async ({ authUserId, params, query, set }) => {
      const result = await listChildStarTransactions({
        parentId: authUserId,
        childId: params.childId,
        cursor: query.cursor,
        limit: parseOptionalNumber(query.limit),
      });

      set.status = 200;
      return {
        transactions: result.transactions.map((t) => ({
          id: t.id,
          child_id: t.childId,
          amount: t.amount,
          type: t.type,
          source_id: t.sourceId,
          created_at: t.createdAt,
        })),
        next_cursor: result.nextCursor,
      };
    },
    {
      params: t.Object({
        childId: t.String(),
      }),
      query: t.Object({
        cursor: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )
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
    "/children/:childId/content-sessions",
    async ({ authUserId, params, body, set }) => {
      const result = await recordContentSession({
        parentId: authUserId,
        childId: params.childId,
        contentId: body.content_id,
        idempotencyKey: body.idempotency_key,
        durationSeconds: body.duration_seconds,
        status: body.status,
        startedAt: body.started_at,
        completedAt: body.completed_at,
        metadata: body.metadata,
        isCorrect: body.is_correct,
        selectedEmotion: body.selected_emotion,
        aiMatchScore: body.ai_match_score,
        aiDetectedEmotion: body.ai_detected_emotion,
        aiConfidence: body.ai_confidence,
        aiScores: body.ai_scores,
      });

      set.status = 201;
      return {
        message: "Content session recorded successfully.",
        session: formatContentSession(result.session as any),
        stars_earned: result.session.starsEarned,
        child_total_stars: result.childTotalStars,
      };
    },
    {
      params: t.Object({
        childId: t.String(),
      }),
      body: t.Object({
        content_id: t.String(),
        idempotency_key: t.Optional(t.String()),
        duration_seconds: t.Optional(t.Number()),
        status: t.Optional(t.String()),
        started_at: t.Optional(t.String()),
        completed_at: t.Optional(t.String()),
        metadata: t.Optional(t.Unknown()),
        is_correct: t.Optional(t.Boolean()),
        selected_emotion: t.Optional(t.String()),
        ai_match_score: t.Optional(t.Number()),
        ai_detected_emotion: t.Optional(t.String()),
        ai_confidence: t.Optional(t.Number()),
        ai_scores: t.Optional(t.Unknown()),
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
