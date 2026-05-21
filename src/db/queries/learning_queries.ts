import { eq, and, desc, sql } from "drizzle-orm";
import type { DbExecutor } from "../client";
import { contents, contentSessions, childProfiles, unlockContent } from "../schema";
import { randomUUID } from "crypto";

export async function getUnlockedContentsByChildId(db: DbExecutor, childId: string) {
  return await db.query.unlockContent.findMany({
    where: eq(unlockContent.childId, childId),
    with: {
      content: {
        with: { lecture: true, quiz: true, game: true } 
      }
    },
    orderBy: [desc(unlockContent.unlockedAt)] 
  });
}

export async function getContentDetailsById(db: DbExecutor, contentId: string) {
  const contentDetail = await db.query.contents.findFirst({
    where: eq(contents.id, contentId),
    with: { lecture: true, quiz: true, game: true }
  });

  if (!contentDetail) throw new Error(`[ERROR] Content ${contentId} not found.`);
  return contentDetail;
}

export async function unlockNewContent(
  db: DbExecutor, 
  childId: string, 
  contentId: string
) {
  const existing = await db.query.unlockContent.findFirst({
    where: and(eq(unlockContent.childId, childId), eq(unlockContent.contentId, contentId))
  });
  if (existing) return existing;

  const [newUnlock] = await db.insert(unlockContent).values({
    id: randomUUID(),
    childId: childId,
    contentId: contentId,
  }).returning();

  if (!newUnlock) throw new Error("[ERROR] Failed to unlock content for child.");
  return newUnlock;
}

export async function finishContentSessionTx(
  db: DbExecutor,
  sessionData: Omit<typeof contentSessions.$inferInsert, "id">, 
  earnedStars: number
) {
  const [session] = await db.insert(contentSessions).values({
    ...sessionData,
    id: randomUUID(),
  }).returning();

  if (!session) throw new Error("[ERROR] Failed to insert content session.");

  if (sessionData.status === "COMPLETED" && earnedStars > 0) {
    const [updatedProfile] = await db.update(childProfiles)
      .set({ 
        totalStars: sql`${childProfiles.totalStars} + ${earnedStars}`,
        updatedAt: sql`NOW()`
      })
      .where(eq(childProfiles.id, sessionData.childId))
      .returning();

    if (!updatedProfile) throw new Error(`[ERROR] Profile ${sessionData.childId} not found to add stars.`);
  }

  return session;
}

export async function getChildLearningHistory(
  db: DbExecutor, 
  childId: string, 
  limit: number = 20
) {
  return await db.query.contentSessions.findMany({
    where: eq(contentSessions.childId, childId),
    with: {
      unlockContent: {
        with: {
          content: true
        }
      }
    },
    orderBy: [desc(contentSessions.createdAt)],
    limit: limit
  });
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
    successRate: stats.totalQuizzes > 0 
      ? Math.round((stats.correctAnswers / stats.totalQuizzes) * 100) 
      : 0
  };
}
