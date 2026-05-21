import { eq, and, sql } from "drizzle-orm";
import type { DbExecutor } from "../client";
import { childProfiles, preferences, unlockContent, game, lectures, quizzes, childPets } from "../schema";
import { randomUUID } from "crypto";

export async function getChildrenByParentId(db: DbExecutor, parentId: string) {
  return await db.query.childProfiles.findMany({
    where: eq(childProfiles.parentId, parentId),
    with: { preferences: true },
  });
}

export async function getChildProfileById(db: DbExecutor, childId: string) {
  return await db.query.childProfiles.findFirst({
    where: eq(childProfiles.id, childId),
    with: { preferences: true },
  });
}

export async function createChildProfileTx(
  db: DbExecutor,
  profileData: typeof childProfiles.$inferInsert,
  targetDifficulty: number
) {
  const [newChild] = await db.insert(childProfiles).values(profileData).returning();
  if (!newChild) throw new Error("[ERROR] Database returned no data for child profile.");

  await db.insert(preferences).values({ 
    childId: newChild.id,
    preferencesData: {} 
  });

  const defaultLectures = await db.select({ id: lectures.id }).from(lectures)
    .where(and(eq(lectures.difficultyLevel, targetDifficulty), eq(lectures.isDefault, true)));
  const defaultQuizzes = await db.select({ id: quizzes.id }).from(quizzes)
    .where(and(eq(quizzes.difficultyLevel, targetDifficulty), eq(quizzes.isDefault, true)));
  const defaultGames = await db.select({ id: game.id }).from(game)
    .where(and(eq(game.difficultyLevel, targetDifficulty), eq(game.isDefault, true)));

  const contentIdsToUnlock = [
    ...defaultLectures.map(l => l.id),
    ...defaultQuizzes.map(q => q.id),
    ...defaultGames.map(g => g.id),
  ];

  if (contentIdsToUnlock.length > 0) {
    const unlocks = contentIdsToUnlock.map(contentId => ({
      id: randomUUID(),
      childId: newChild.id,
      contentId: contentId,
    }));
    await db.insert(unlockContent).values(unlocks);
  }

  return newChild;
}

export async function updateChildProfile(
  db: DbExecutor,
  childId: string,
  data: Partial<Omit<typeof childProfiles.$inferInsert, "id" | "parentId" | "totalStars" | "createdAt">>
) {
  const [updatedChild] = await db.update(childProfiles)
    .set({ ...data, updatedAt: sql`NOW()` })
    .where(eq(childProfiles.id, childId))
    .returning();

  if (!updatedChild) throw new Error(`[ERROR] Child profile ${childId} not found.`);
  return updatedChild;
}

export async function deleteChildProfile(db: DbExecutor, childId: string) {
  const [deletedChild] = await db.delete(childProfiles)
    .where(eq(childProfiles.id, childId))
    .returning();

  if (!deletedChild) throw new Error(`[ERROR] Child profile ${childId} not found to delete.`);
  return deletedChild;
}

export async function updatePreferences(db: DbExecutor, childId: string, data: typeof preferences.$inferInsert) {
  const [updatedPref] = await db.update(preferences)
    .set({ ...data, updatedAt: sql`NOW()` })
    .where(eq(preferences.childId, childId))
    .returning();
    
  if (!updatedPref) throw new Error(`[ERROR] Preferences for child ${childId} not found.`);
  return updatedPref;
}

export async function isContentUnlocked(db: DbExecutor, childId: string, contentId: string): Promise<boolean> {
  const record = await db.query.unlockContent.findFirst({
    where: and(
      eq(unlockContent.childId, childId),
      eq(unlockContent.contentId, contentId)
    ),
  });
  return !!record;
}

export async function getChildPetsByChildId(db: DbExecutor, childId: string) {
  return await db.query.childPets.findMany({
    where: eq(childPets.childId, childId),
    with: {
      pet: true,
    },
  });
}
