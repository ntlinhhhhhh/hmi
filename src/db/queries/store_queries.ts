import { eq, and, isNull, sql, gte } from "drizzle-orm";
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
    .where(and(eq(childProfiles.id, childId), gte(childProfiles.totalStars, cost)))
    .returning();

  if (!updatedProfile) return null;

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
  return {
    childPet: newChildPet,
    childTotalStars: updatedProfile.totalStars,
  };
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
    .where(and(eq(childProfiles.id, childId), gte(childProfiles.totalStars, cost)))
    .returning();

  if (!updatedProfile) return null;

  const [newUnlock] = await db
    .insert(unlockContent)
    .values({
      id: randomUUID(),
      childId: childId,
      contentId: contentId,
    })
    .returning();

  if (!newUnlock) throw new Error("[ERROR] Failed to unlock premium content.");
  return {
    unlock: newUnlock,
    childTotalStars: updatedProfile.totalStars,
  };
}

export async function getActiveStorePetById(db: DbExecutor, petId: string) {
  return await db.query.pets.findFirst({
    where: and(eq(pets.id, petId), eq(pets.status, "ACTIVE"), isNull(pets.deletedAt)),
  });
}

export async function getChildPetById(db: DbExecutor, childPetId: string) {
  return await db.query.childPets.findFirst({
    where: eq(childPets.id, childPetId),
    with: {
      pet: true,
    },
  });
}

export async function updateChildPetCustomName(
  db: DbExecutor,
  childPetId: string,
  customName: string | null,
) {
  const [updatedChildPet] = await db
    .update(childPets)
    .set({ customName })
    .where(eq(childPets.id, childPetId))
    .returning();

  if (!updatedChildPet) throw new Error(`[ERROR] Child pet ${childPetId} not found.`);
  return updatedChildPet;
}
