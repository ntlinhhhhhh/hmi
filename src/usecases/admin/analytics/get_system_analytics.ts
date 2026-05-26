import { db } from "../../../db/client.ts";
import {
  alerts,
  users,
  childProfiles,
  contentSessions,
  emotionLogs,
  unlockContent,
  contents,
} from "../../../db/schema.ts";
import { eq, and, sql, gte, lte, isNull, type SQL } from "drizzle-orm";
import { AppError } from "../../app_error.ts";
import { normalizeAdminId, requireActiveAdmin } from "../admin_authorization.ts";

export type SystemAnalyticsInput = {
  adminId: string;
  from?: string;
  to?: string;
};

export type SystemAnalyticsResult = {
  users: {
    total: number;
    parents: number;
    admins: number;
    banned: number;
    active: number;
  };
  children: {
    total: number;
  };
  learning: {
    totalSessions: number;
    completedSessions: number;
    completionRate: number;
    totalQuizzes: number;
    correctQuizzes: number;
    quizSuccessRate: number;
  };
  emotions: Record<string, number>;
  alertsCount: number;
};

export async function getSystemAnalytics(
  input: SystemAnalyticsInput,
): Promise<SystemAnalyticsResult> {
  const adminId = normalizeAdminId(input.adminId);
  await requireActiveAdmin(adminId);

  const fromDate: string | null = input.from?.trim() || null;
  const toDate: string | null = input.to?.trim() || null;

  try {
    // 1. User counts
    const [userCounts] = await db
      .select({
        total: sql<number>`count(*)::int`,
        parents: sql<number>`count(CASE WHEN role = 'PARENT' THEN 1 END)::int`,
        admins: sql<number>`count(CASE WHEN role = 'ADMIN' THEN 1 END)::int`,
        banned: sql<number>`count(CASE WHEN status = 'BANNED' THEN 1 END)::int`,
        active: sql<number>`count(CASE WHEN status = 'ACTIVE' THEN 1 END)::int`,
      })
      .from(users);

    // 2. Child profile count
    const [childCounts] = await db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(childProfiles);

    // 3. Learning stats
    const learningConditions: SQL<unknown>[] = [];
    if (fromDate) {
      learningConditions.push(gte(contentSessions.createdAt, fromDate));
    }
    if (toDate) {
      learningConditions.push(lte(contentSessions.createdAt, toDate));
    }

    const [learningStats] = await db
      .select({
        totalSessions: sql<number>`count(*)::int`,
        completedSessions: sql<number>`count(CASE WHEN ${contentSessions.status} = 'COMPLETED' THEN 1 END)::int`,
      })
      .from(contentSessions)
      .where(learningConditions.length > 0 ? and(...learningConditions) : undefined);

    // Quiz stats by joining contents
    const quizConditions: SQL<unknown>[] = [eq(contents.type, "QUIZ"), isNull(contents.deletedAt)];
    if (fromDate) {
      quizConditions.push(gte(contentSessions.createdAt, fromDate));
    }
    if (toDate) {
      quizConditions.push(lte(contentSessions.createdAt, toDate));
    }

    const [quizStats] = await db
      .select({
        totalQuizzes: sql<number>`count(*)::int`,
        correctQuizzes: sql<number>`count(CASE WHEN ${contentSessions.isCorrect} = true THEN 1 END)::int`,
      })
      .from(contentSessions)
      .innerJoin(unlockContent, eq(unlockContent.id, contentSessions.unlockContentId))
      .innerJoin(contents, eq(contents.id, unlockContent.contentId))
      .where(and(...quizConditions));

    // 4. Emotion logs aggregation
    const emotionConditions: SQL<unknown>[] = [];
    if (fromDate) {
      emotionConditions.push(gte(emotionLogs.createdAt, fromDate));
    }
    if (toDate) {
      emotionConditions.push(lte(emotionLogs.createdAt, toDate));
    }

    const emotionRows = await db
      .select({
        emotion: emotionLogs.emotionValue,
        count: sql<number>`count(*)::int`,
      })
      .from(emotionLogs)
      .where(emotionConditions.length > 0 ? and(...emotionConditions) : undefined)
      .groupBy(emotionLogs.emotionValue);

    const emotions: Record<string, number> = {};
    for (const row of emotionRows) {
      emotions[row.emotion] = row.count;
    }

    // 5. Persisted chatbot warning alert count
    const alertConditions: SQL<unknown>[] = [];
    if (fromDate) {
      alertConditions.push(gte(alerts.createdAt, fromDate));
    }
    if (toDate) {
      alertConditions.push(lte(alerts.createdAt, toDate));
    }

    const [alertsStats] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(alerts)
      .where(alertConditions.length > 0 ? and(...alertConditions) : undefined);

    const totalSessions = learningStats?.totalSessions ?? 0;
    const completedSessions = learningStats?.completedSessions ?? 0;
    const totalQuizzes = quizStats?.totalQuizzes ?? 0;
    const correctQuizzes = quizStats?.correctQuizzes ?? 0;

    return {
      users: {
        total: userCounts?.total ?? 0,
        parents: userCounts?.parents ?? 0,
        admins: userCounts?.admins ?? 0,
        banned: userCounts?.banned ?? 0,
        active: userCounts?.active ?? 0,
      },
      children: {
        total: childCounts?.total ?? 0,
      },
      learning: {
        totalSessions,
        completedSessions,
        completionRate:
          totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0,
        totalQuizzes,
        correctQuizzes,
        quizSuccessRate: totalQuizzes > 0 ? Math.round((correctQuizzes / totalQuizzes) * 100) : 0,
      },
      emotions,
      alertsCount: alertsStats?.count ?? 0,
    };
  } catch (error: unknown) {
    if (error instanceof AppError) throw error;
    console.error("[ERROR] Unexpected error in getSystemAnalytics:", error);
    throw new AppError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
