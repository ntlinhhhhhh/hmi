import { randomUUID } from "crypto";
import { and, desc, eq, gte, lt, lte, type SQL } from "drizzle-orm";
import type { DbExecutor } from "../client";
import { emotionLogs, regulationEvents } from "../schema";

export type RegulationEventListFilters = {
  action?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit: number;
};

export async function getChildEmotionLogById(
  db: DbExecutor,
  childId: string,
  emotionLogId: string,
) {
  return await db.query.emotionLogs.findFirst({
    where: and(eq(emotionLogs.id, emotionLogId), eq(emotionLogs.childId, childId)),
  });
}

export async function createRegulationEvent(
  db: DbExecutor,
  data: Omit<typeof regulationEvents.$inferInsert, "id">,
) {
  const [event] = await db
    .insert(regulationEvents)
    .values({
      ...data,
      id: randomUUID(),
    })
    .returning();

  if (!event) {
    throw new Error("[ERROR] Failed to insert regulation event.");
  }

  return event;
}

export async function listRegulationEvents(
  db: DbExecutor,
  childId: string,
  filters: RegulationEventListFilters,
) {
  const conditions: SQL<unknown>[] = [eq(regulationEvents.childId, childId)];

  if (filters.action !== undefined) {
    conditions.push(eq(regulationEvents.action, filters.action));
  }

  if (filters.from !== undefined) {
    conditions.push(gte(regulationEvents.createdAt, filters.from));
  }

  if (filters.to !== undefined) {
    conditions.push(lte(regulationEvents.createdAt, filters.to));
  }

  if (filters.cursor !== undefined) {
    conditions.push(lt(regulationEvents.createdAt, filters.cursor));
  }

  return await db.query.regulationEvents.findMany({
    where: and(...conditions),
    orderBy: [desc(regulationEvents.createdAt)],
    limit: filters.limit,
  });
}
