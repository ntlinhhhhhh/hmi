import { eq, and, desc, exists, gt, gte, lte, lt, isNull, sql, type SQL } from "drizzle-orm";
import type { DbExecutor } from "../client";
import { contents, contentSessions, childProfiles, unlockContent, starTransactions } from "../schema";
import { randomUUID } from "crypto";
import { MAX_CONTENT_COMPLETION_REWARD_STARS } from "../../domain/reward_policy.ts";

export async function getUnlockedContentsByChildId(db: DbExecutor, childId: string) {
  return await db.query.unlockContent.findMany({
    where: and(
      eq(unlockContent.childId, childId),
      exists(
        db
          .select({ id: contents.id })
          .from(contents)
          .where(and(eq(contents.id, unlockContent.contentId), isNull(contents.deletedAt))),
      ),
    ),
    with: {
      content: {
        with: { lecture: true, quiz: true, game: true },
      },
    },
    orderBy: [desc(unlockContent.unlockedAt)],
  });
}

export async function getContentDetailsById(db: DbExecutor, contentId: string) {
  const contentDetail = await db.query.contents.findFirst({
    where: and(eq(contents.id, contentId), isNull(contents.deletedAt)),
    with: { lecture: true, quiz: true, game: true },
  });

  if (!contentDetail) throw new Error(`[ERROR] Content ${contentId} not found.`);
  return contentDetail;
}

export type PublishedContentCatalogFilters = {
  type?: string;
};

export async function getPublishedContentCatalog(
  db: DbExecutor,
  filters: PublishedContentCatalogFilters = {},
) {
  const conditions: SQL<unknown>[] = [eq(contents.status, "PUBLISHED"), isNull(contents.deletedAt)];

  if (filters.type !== undefined) {
    conditions.push(eq(contents.type, filters.type));
  }

  return await db.query.contents.findMany({
    where: and(...conditions),
    with: { lecture: true, quiz: true, game: true },
    orderBy: (contents, { asc }) => [asc(contents.type), asc(contents.title)],
  });
}

export async function findPublishedContentDetailById(db: DbExecutor, contentId: string) {
  return await db.query.contents.findFirst({
    where: and(
      eq(contents.id, contentId),
      eq(contents.status, "PUBLISHED"),
      isNull(contents.deletedAt),
    ),
    with: { lecture: true, quiz: true, game: true },
  });
}

export async function getChildContentUnlocks(db: DbExecutor, childId: string) {
  return await db.query.unlockContent.findMany({
    where: eq(unlockContent.childId, childId),
  });
}

export async function getChildContentUnlockByContentId(
  db: DbExecutor,
  childId: string,
  contentId: string,
) {
  return await db.query.unlockContent.findFirst({
    where: and(eq(unlockContent.childId, childId), eq(unlockContent.contentId, contentId)),
  });
}

export async function getContentSessionByChildIdempotencyKey(
  db: DbExecutor,
  childId: string,
  idempotencyKey: string,
) {
  return await db.query.contentSessions.findFirst({
    where: and(
      eq(contentSessions.childId, childId),
      eq(contentSessions.idempotencyKey, idempotencyKey),
    ),
    with: {
      unlockContent: {
        with: {
          content: true,
        },
      },
    },
  });
}

export async function getChildContentProgressRows(db: DbExecutor, childId: string) {
  return await db
    .select({
      contentId: unlockContent.contentId,
      totalSessions: sql<number>`count(${contentSessions.id})::int`,
      completedSessions: sql<number>`count(CASE WHEN ${contentSessions.status} = 'COMPLETED' THEN 1 END)::int`,
      starsEarned: sql<number>`coalesce(sum(${contentSessions.starsEarned}), 0)::int`,
      lastSessionAt: sql<string | null>`max(${contentSessions.createdAt})`,
    })
    .from(contentSessions)
    .innerJoin(unlockContent, eq(unlockContent.id, contentSessions.unlockContentId))
    .where(eq(contentSessions.childId, childId))
    .groupBy(unlockContent.contentId);
}

export async function unlockNewContent(db: DbExecutor, childId: string, contentId: string) {
  const existing = await db.query.unlockContent.findFirst({
    where: and(eq(unlockContent.childId, childId), eq(unlockContent.contentId, contentId)),
  });
  if (existing) return existing;

  const [newUnlock] = await db
    .insert(unlockContent)
    .values({
      id: randomUUID(),
      childId: childId,
      contentId: contentId,
    })
    .returning();

  if (!newUnlock) throw new Error("[ERROR] Failed to unlock content for child.");
  return newUnlock;
}

export async function finishContentSessionTx(
  db: DbExecutor,
  sessionData: Omit<typeof contentSessions.$inferInsert, "id">,
  earnedStars: number,
) {
  if (
    !Number.isInteger(earnedStars) ||
    earnedStars < 0 ||
    earnedStars > MAX_CONTENT_COMPLETION_REWARD_STARS
  ) {
    throw new Error(
      `[ERROR] earnedStars must be an integer from 0 to ${MAX_CONTENT_COMPLETION_REWARD_STARS}.`,
    );
  }

  const sessionStatus = sessionData.status ?? "COMPLETED";
  let effectiveEarnedStars = sessionStatus === "COMPLETED" ? earnedStars : 0;

  if (effectiveEarnedStars > 0) {
    const rewardLockKey = `content-session-reward:${sessionData.childId}:${sessionData.unlockContentId}`;
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${rewardLockKey}))`);

    const existingRewardedSession = await db.query.contentSessions.findFirst({
      columns: { id: true },
      where: and(
        eq(contentSessions.childId, sessionData.childId),
        eq(contentSessions.unlockContentId, sessionData.unlockContentId),
        eq(contentSessions.status, "COMPLETED"),
        gt(contentSessions.starsEarned, 0),
      ),
    });

    if (existingRewardedSession) {
      effectiveEarnedStars = 0;
    }
  }

  const [session] = await db
    .insert(contentSessions)
    .values({
      ...sessionData,
      id: randomUUID(),
      status: sessionStatus,
      starsEarned: effectiveEarnedStars,
    })
    .returning();

  if (!session) throw new Error("[ERROR] Failed to insert content session.");

  if (effectiveEarnedStars > 0) {
    const [updatedProfile] = await db
      .update(childProfiles)
      .set({
        totalStars: sql`${childProfiles.totalStars} + ${effectiveEarnedStars}`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(childProfiles.id, sessionData.childId))
      .returning();

    if (!updatedProfile)
      throw new Error(`[ERROR] Profile ${sessionData.childId} not found to add stars.`);

    await db.insert(starTransactions).values({
      id: randomUUID(),
      childId: sessionData.childId,
      amount: effectiveEarnedStars,
      type: "LEARNING_REWARD",
      sourceId: session.id,
    });
  }

  return session;
}

export async function getChildLearningHistory(db: DbExecutor, childId: string, limit: number = 20) {
  return await db.query.contentSessions.findMany({
    where: eq(contentSessions.childId, childId),
    with: {
      unlockContent: {
        with: {
          content: true,
        },
      },
    },
    orderBy: [desc(contentSessions.createdAt)],
    limit: limit,
  });
}

export type ContentSessionListFilters = {
  type?: string;
  status?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit: number;
};

export async function listChildContentSessionRows(
  db: DbExecutor,
  childId: string,
  filters: ContentSessionListFilters,
) {
  const conditions: SQL<unknown>[] = [eq(contentSessions.childId, childId)];

  if (filters.status !== undefined) {
    conditions.push(eq(contentSessions.status, filters.status));
  }
  if (filters.from !== undefined) {
    conditions.push(gte(contentSessions.createdAt, filters.from));
  }
  if (filters.to !== undefined) {
    conditions.push(lte(contentSessions.createdAt, filters.to));
  }
  if (filters.cursor !== undefined) {
    conditions.push(lt(contentSessions.createdAt, filters.cursor));
  }

  if (filters.type !== undefined) {
    return await db
      .select({
        session: contentSessions,
        contentId: unlockContent.contentId,
      })
      .from(contentSessions)
      .innerJoin(unlockContent, eq(unlockContent.id, contentSessions.unlockContentId))
      .innerJoin(contents, eq(contents.id, unlockContent.contentId))
      .where(and(...conditions, eq(contents.type, filters.type), isNull(contents.deletedAt)))
      .orderBy(desc(contentSessions.createdAt))
      .limit(filters.limit);
  } else {
    return await db
      .select({
        session: contentSessions,
        contentId: unlockContent.contentId,
      })
      .from(contentSessions)
      .innerJoin(unlockContent, eq(unlockContent.id, contentSessions.unlockContentId))
      .where(and(...conditions))
      .orderBy(desc(contentSessions.createdAt))
      .limit(filters.limit);
  }
}

export async function getLearningSummary(db: DbExecutor, childId: string) {
  const [stats] = await db
    .select({
      totalSessions: sql<number>`count(*)::int`,
      completedSessions: sql<number>`count(CASE WHEN status = 'COMPLETED' THEN 1 END)::int`,
      totalStars: sql<number>`sum(stars_earned)::int`,
      correctAnswers: sql<number>`count(CASE WHEN is_correct = true THEN 1 END)::int`,
      totalQuizzes: sql<number>`count(CASE WHEN is_correct IS NOT NULL THEN 1 END)::int`,
    })
    .from(contentSessions)
    .where(eq(contentSessions.childId, childId));

  if (!stats) throw new Error(`[ERROR] Failed to calculate learning summary for child ${childId}.`);

  return {
    ...stats,
    successRate:
      stats.totalQuizzes > 0 ? Math.round((stats.correctAnswers / stats.totalQuizzes) * 100) : 0,
  };
}
