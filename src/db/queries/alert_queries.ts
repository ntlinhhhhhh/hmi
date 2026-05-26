import { and, count, desc, eq, gte, lt, lte, type SQL } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { DbExecutor } from "../client";
import { alerts } from "../schema";

export type AlertListFilters = {
  from?: string;
  to?: string;
  cursor?: string;
  limit: number;
};

export async function createAlert(db: DbExecutor, data: Omit<typeof alerts.$inferInsert, "id">) {
  const [alert] = await db
    .insert(alerts)
    .values({
      ...data,
      id: randomUUID(),
    })
    .returning();

  if (!alert) {
    throw new Error("[ERROR] Failed to insert alert. Database returned no data.");
  }

  return alert;
}

export async function updateAlertNotificationStatus(
  db: DbExecutor,
  alertId: string,
  data: Pick<
    typeof alerts.$inferInsert,
    "notificationStatus" | "notificationSentAt" | "notificationError"
  >,
) {
  const [alert] = await db.update(alerts).set(data).where(eq(alerts.id, alertId)).returning();

  if (!alert) {
    throw new Error(`[ERROR] Alert ${alertId} not found.`);
  }

  return alert;
}

export async function listChildAlertRows(
  db: DbExecutor,
  childId: string,
  filters: AlertListFilters,
) {
  const conditions: SQL<unknown>[] = [eq(alerts.childId, childId)];

  if (filters.from !== undefined) {
    conditions.push(gte(alerts.createdAt, filters.from));
  }
  if (filters.to !== undefined) {
    conditions.push(lte(alerts.createdAt, filters.to));
  }
  if (filters.cursor !== undefined) {
    conditions.push(lt(alerts.createdAt, filters.cursor));
  }

  return await db.query.alerts.findMany({
    where: and(...conditions),
    orderBy: [desc(alerts.createdAt)],
    limit: filters.limit,
  });
}

export async function countChildAlerts(
  db: DbExecutor,
  childId: string,
  from?: string,
  to?: string,
) {
  const conditions: SQL<unknown>[] = [eq(alerts.childId, childId)];

  if (from !== undefined) {
    conditions.push(gte(alerts.createdAt, from));
  }
  if (to !== undefined) {
    conditions.push(lte(alerts.createdAt, to));
  }

  const [row] = await db
    .select({ total: count() })
    .from(alerts)
    .where(and(...conditions));

  return Number(row?.total ?? 0);
}
