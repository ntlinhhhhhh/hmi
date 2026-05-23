import { Elysia, t } from "elysia";
import { getChildDashboard } from "../usecases/dashboard/get_child_dashboard.ts";
import { listEmotionLogs } from "../usecases/tracking/list_emotion_logs.ts";
import { recordEmotionLog } from "../usecases/tracking/log_emotion.ts";
import { withApiErrorHandler } from "./api_error_handler.ts";
import { requireAuth } from "./middleware/require_auth.ts";

function parseDays(rawDays: string | undefined): number | undefined {
  if (rawDays === undefined || rawDays.trim() === "") return undefined;
  return Number(rawDays);
}

function parseOptionalNumber(rawValue: string | undefined): number | undefined {
  if (rawValue === undefined || rawValue.trim() === "") return undefined;
  return Number(rawValue);
}

const protectedTrackingRouter = new Elysia()
  .use(requireAuth)
  .post(
    "/children/:childId/emotion-logs",
    async ({ authUserId, params, body, set }) => {
      const log = await recordEmotionLog({
        parentId: authUserId,
        childId: params.childId,
        emotionValue: body.emotion_value,
        triggerSource: body.trigger_source,
        durationSeconds: body.duration_seconds,
      });

      set.status = 201;
      return {
        message: "Emotion log recorded successfully.",
        log: {
          id: log.id,
          child_id: log.childId,
          emotion_value: log.emotionValue,
          trigger_source: log.triggerSource,
          duration_seconds: log.durationSeconds,
          created_at: log.createdAt,
        },
      };
    },
    {
      params: t.Object({
        childId: t.String(),
      }),
      body: t.Object({
        emotion_value: t.String(),
        trigger_source: t.String(),
        duration_seconds: t.Optional(t.Number()),
      }),
    },
  )
  .get(
    "/children/:childId/emotion-logs",
    async ({ authUserId, params, query, set }) => {
      const result = await listEmotionLogs({
        parentId: authUserId,
        childId: params.childId,
        emotionValue: query.emotion,
        triggerSource: query.trigger_source,
        from: query.from,
        to: query.to,
        cursor: query.cursor,
        limit: parseOptionalNumber(query.limit),
      });

      set.status = 200;
      return {
        logs: result.logs.map((log) => ({
          id: log.id,
          child_id: log.childId,
          emotion_value: log.emotionValue,
          trigger_source: log.triggerSource,
          duration_seconds: log.durationSeconds,
          created_at: log.createdAt,
        })),
        next_cursor: result.nextCursor,
      };
    },
    {
      params: t.Object({
        childId: t.String(),
      }),
      query: t.Object({
        emotion: t.Optional(t.String()),
        trigger_source: t.Optional(t.String()),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/children/:childId/dashboard",
    async ({ authUserId, params, query, set }) => {
      const dashboard = await getChildDashboard({
        parentId: authUserId,
        childId: params.childId,
        days: parseDays(query.days),
      });

      set.status = 200;
      return {
        child: {
          id: dashboard.child.id,
          nickname: dashboard.child.nickname,
          total_stars: dashboard.child.totalStars,
          birth_year: dashboard.child.birthYear,
        },
        learning: {
          total_sessions: dashboard.learning.totalSessions,
          completed_sessions: dashboard.learning.completedSessions,
          total_stars: dashboard.learning.totalStars,
          correct_answers: dashboard.learning.correctAnswers,
          total_quizzes: dashboard.learning.totalQuizzes,
          success_rate: dashboard.learning.successRate,
        },
        emotions: dashboard.emotions.map((emotion) => ({
          emotion: emotion.emotion,
          count: emotion.count,
        })),
        meltdown_alerts: dashboard.meltdownAlerts.map((alert) => ({
          id: alert.id,
          emotion_value: alert.emotionValue,
          trigger_source: alert.triggerSource,
          duration_seconds: alert.durationSeconds,
          created_at: alert.createdAt,
        })),
      };
    },
    {
      params: t.Object({
        childId: t.String(),
      }),
      query: t.Object({
        days: t.Optional(t.String()),
      }),
    },
  );

const trackingRouter = withApiErrorHandler(new Elysia(), {
  validationErrorType: "INVALID_JSON",
}).use(protectedTrackingRouter);

export default trackingRouter;
