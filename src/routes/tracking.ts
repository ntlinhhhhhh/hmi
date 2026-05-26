import { Elysia, t } from "elysia";
import { getChildDashboard } from "../usecases/dashboard/get_child_dashboard.ts";
import { exportChildSummaryPdf } from "../usecases/reports/export_child_summary_pdf.ts";
import { createChatbotAlert } from "../usecases/tracking/create_chatbot_alert.ts";
import { listEmotionLogs } from "../usecases/tracking/list_emotion_logs.ts";
import { listChildAlerts } from "../usecases/tracking/list_child_alerts.ts";
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

function formatChatbotAlert(alert: {
  id: string;
  childId: string;
  reason: string;
  source: string;
  notificationStatus: string;
  notificationSentAt: string | null;
  notificationError: string | null;
  createdAt: string;
}) {
  return {
    id: alert.id,
    child_id: alert.childId,
    reason: alert.reason,
    source: alert.source,
    notification_status: alert.notificationStatus,
    notification_sent_at: alert.notificationSentAt,
    notification_error: alert.notificationError,
    created_at: alert.createdAt,
  };
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
        confidenceScore: body.confidence_score,
        aiEmotionLabel: body.ai_emotion_label,
        aiConfidence: body.ai_confidence,
        aiScores: body.ai_scores,
        aiResult: body.ai_result,
        metadata: body.metadata,
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
          confidence_score: log.confidenceScore,
          ai_emotion_label: log.aiEmotionLabel,
          ai_confidence: log.aiConfidence,
          ai_scores: log.aiScores,
          metadata: log.metadata,
          created_at: log.createdAt,
        },
      };
    },
    {
      params: t.Object({
        childId: t.String(),
      }),
      body: t.Object({
        emotion_value: t.Optional(t.String()),
        trigger_source: t.String(),
        duration_seconds: t.Optional(t.Number()),
        confidence_score: t.Optional(t.Number()),
        ai_emotion_label: t.Optional(t.String()),
        ai_confidence: t.Optional(t.Number()),
        ai_scores: t.Optional(t.Unknown()),
        ai_result: t.Optional(t.Unknown()),
        metadata: t.Optional(t.Unknown()),
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
          confidence_score: log.confidenceScore,
          ai_emotion_label: log.aiEmotionLabel,
          ai_confidence: log.aiConfidence,
          ai_scores: log.aiScores,
          metadata: log.metadata,
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
        chatbot_alerts: {
          total: dashboard.chatbotAlerts.total,
          recent: dashboard.chatbotAlerts.recent.map((alert) => ({
            id: alert.id,
            reason: alert.reason,
            notification_status: alert.notificationStatus,
            notification_sent_at: alert.notificationSentAt,
            notification_error: alert.notificationError,
            created_at: alert.createdAt,
          })),
        },
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
  )
  .post(
    "/children/:childId/alerts",
    async ({ authUserId, params, body, set }) => {
      const alert = await createChatbotAlert({
        parentId: authUserId,
        childId: params.childId,
        reason: body.reason,
      });

      set.status = 201;
      return {
        message: "Chatbot warning alert recorded successfully.",
        alert: formatChatbotAlert(alert),
      };
    },
    {
      params: t.Object({
        childId: t.String(),
      }),
      body: t.Object({
        reason: t.String(),
      }),
    },
  )
  .get(
    "/children/:childId/alerts",
    async ({ authUserId, params, query, set }) => {
      const result = await listChildAlerts({
        parentId: authUserId,
        childId: params.childId,
        from: query.from,
        to: query.to,
        cursor: query.cursor,
        limit: parseOptionalNumber(query.limit),
      });

      set.status = 200;
      return {
        alerts: result.alerts.map(formatChatbotAlert),
        next_cursor: result.nextCursor,
      };
    },
    {
      params: t.Object({
        childId: t.String(),
      }),
      query: t.Object({
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/children/:childId/reports/summary.pdf",
    async ({ authUserId, params, query }) => {
      const report = await exportChildSummaryPdf({
        parentId: authUserId,
        childId: params.childId,
        from: query.from,
        to: query.to,
        days: parseDays(query.days),
      });

      return new Response(report.pdfBytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${report.fileName}"`,
          "Content-Length": report.pdfBytes.byteLength.toString(),
        },
      });
    },
    {
      params: t.Object({
        childId: t.String(),
      }),
      query: t.Object({
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        days: t.Optional(t.String()),
      }),
    },
  );

const trackingRouter = withApiErrorHandler(new Elysia(), {
  validationErrorType: "INVALID_JSON",
}).use(protectedTrackingRouter);

export default trackingRouter;
