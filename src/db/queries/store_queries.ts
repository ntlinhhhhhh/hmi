import { eq, and, isNull, sql } from "drizzle-orm";
import type { DbExecutor } from "../client";
import { pets, childPets, childProfiles, unlockContent } from "../schema";
import { randomUUID } from "crypto";

export async function getActiveStorePets(db: DbExecutor) {
  return await db.query.pets.findMany({
    where: and(eq(pets.status, "ACTIVE"), isNull(pets.deletedAt)),
    orderBy: (pets, { asc }) => [asc(pets.unlockStarCost)],
  });
}

export async function buyPetTx(
  db: DbExecutor,
  childId: string,
  petId: string,
  cost: number,
  customName?: string,
) {
  const [updatedProfile] = await db
    .update(childProfiles)
    .set({
      totalStars: sql`${childProfiles.totalStars} - ${cost}`,
      updatedAt: sql`NOW()`,
    })
    .where(eq(childProfiles.id, childId))
    .returning();

  if (!updatedProfile) throw new Error(`[ERROR] Child ${childId} not found to deduct stars.`);

  const [newChildPet] = await db
    .insert(childPets)
    .values({
      id: randomUUID(),
      childId: childId,
      petId: petId,
      customName: customName || null,
    })
    .returning();

  if (!newChildPet) throw new Error("[ERROR] Failed to insert into child_pets.");
  return newChildPet;
}

export async function unlockPremiumContentTx(
  db: DbExecutor,
  childId: string,
  contentId: string,
  cost: number,
) {
  const [updatedProfile] = await db
    .update(childProfiles)
    .set({
      totalStars: sql`${childProfiles.totalStars} - ${cost}`,
      updatedAt: sql`NOW()`,
    })
    .where(eq(childProfiles.id, childId))
    .returning();

  if (!updatedProfile) throw new Error(`[ERROR] Child ${childId} not found to deduct stars.`);

  const [newUnlock] = await db
    .insert(unlockContent)
    .values({
      id: randomUUID(),
      childId: childId,
      contentId: contentId,
    })
    .returning();

  if (!newUnlock) throw new Error("[ERROR] Failed to unlock premium content.");
  return newUnlock;
}
