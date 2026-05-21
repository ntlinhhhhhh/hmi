import { eq, desc, sql, and, gte } from "drizzle-orm";
import type { DbExecutor } from "../client";
import { emotionLogs } from "../schema";
import { randomUUID } from "crypto";

export async function logEmotionEvent(
  db: DbExecutor, 
  data: Omit<typeof emotionLogs.$inferInsert, "id">
) {
    const [log] = await db.insert(emotionLogs).values({
      ...data,
      id: randomUUID(),
    }).returning();

    if (!log) {
      throw new Error("[ERROR] Failed to insert emotion log. Database returned no data.");
    }

    return log;
}

export async function getRecentEmotionLogs(db: DbExecutor, childId: string, limit: number = 100) {
  return await db.query.emotionLogs.findMany({
    where: eq(emotionLogs.childId, childId),
    orderBy: [desc(emotionLogs.createdAt)],
    limit: limit
  });
}

export async function getEmotionStats(db: DbExecutor, childId: string, days: number = 7) {
  return await db
    .select({
      emotion: emotionLogs.emotionValue,
      count: sql<number>`count(*)::int`,
    })
    .from(emotionLogs)
    .where(
      and(
        eq(emotionLogs.childId, childId),
        gte(emotionLogs.createdAt, sql`NOW() - interval '${sql.raw(days.toString())} days'`)
      )
    )
    .groupBy(emotionLogs.emotionValue);
}

export async function getMeltdownAlerts(db: DbExecutor, childId: string, days: number = 30) {
  return await db
    .select()
    .from(emotionLogs)
    .where(
      and(
        eq(emotionLogs.childId, childId),
        sql`emotion_value = ANY(ARRAY['SAD', 'ANGRY', 'STRESSED'])`,
        sql`duration_seconds > 60`,
        gte(emotionLogs.createdAt, sql`NOW() - interval '${sql.raw(days.toString())} days'`)
      )
    )
    .orderBy(desc(emotionLogs.createdAt));
}