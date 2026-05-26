import { and, desc, eq, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import type { DbExecutor } from "../client";
import { childProfiles, sessions, users } from "../schema";

export type AdminUserListFilters = {
  role?: string;
  status?: string;
  search?: string;
  cursor?: string;
  limit: number;
};

export async function listAdminUserRows(db: DbExecutor, filters: AdminUserListFilters) {
  const conditions: SQL<unknown>[] = [];

  if (filters.role !== undefined) {
    conditions.push(eq(users.role, filters.role));
  }

  if (filters.status !== undefined) {
    conditions.push(eq(users.status, filters.status));
  }

  if (filters.search !== undefined) {
    const pattern = `%${filters.search}%`;
    const searchCondition = or(
      ilike(users.email, pattern),
      ilike(users.phoneNumber, pattern),
      ilike(users.fullName, pattern),
    );
    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  if (filters.cursor !== undefined) {
    conditions.push(lt(users.createdAt, filters.cursor));
  }

  return await db.query.users.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(users.createdAt)],
    limit: filters.limit,
  });
}

export async function getAdminUserRowById(db: DbExecutor, userId: string) {
  return await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
}

export async function getUserChildCount(db: DbExecutor, userId: string) {
  const [stats] = await db
    .select({
      childCount: sql<number>`count(*)::int`,
    })
    .from(childProfiles)
    .where(eq(childProfiles.parentId, userId));

  return Number(stats?.childCount ?? 0);
}

export async function getUserSessionSummary(db: DbExecutor, userId: string) {
  const [stats] = await db
    .select({
      totalSessions: sql<number>`count(*)::int`,
      activeSessions: sql<number>`count(CASE WHEN ${sessions.expiresAt} > NOW() THEN 1 END)::int`,
      lastUsedAt: sql<string | null>`max(${sessions.lastUsedAt})`,
    })
    .from(sessions)
    .where(eq(sessions.userId, userId));

  return {
    totalSessions: Number(stats?.totalSessions ?? 0),
    activeSessions: Number(stats?.activeSessions ?? 0),
    lastUsedAt: stats?.lastUsedAt ?? null,
  };
}
