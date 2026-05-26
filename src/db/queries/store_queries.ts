import { eq, and, isNull, sql, gte, ilike, or, lt, type SQL } from "drizzle-orm";
import type { DbExecutor } from "../client";
import { pets, childPets, childProfiles, unlockContent, starTransactions } from "../schema";
import { randomUUID } from "crypto";

export type ActiveStorePetsFilters = {
  cursor?: string;
  limit: number;
};

export async function getActiveStorePets(db: DbExecutor, filters: ActiveStorePetsFilters) {
  const conditions = [eq(pets.status, "ACTIVE"), isNull(pets.deletedAt)];
  if (filters.cursor !== undefined) {
    conditions.push(lt(pets.createdAt, filters.cursor));
  }
  return await db.query.pets.findMany({
    where: and(...conditions),
    orderBy: (pets, { desc }) => [desc(pets.createdAt)],
    limit: filters.limit,
  });
}

export type AdminPetListFilters = {
  status?: string;
  search?: string;
  cursor?: string;
  limit: number;
};

export async function getAdminStorePets(db: DbExecutor, filters: AdminPetListFilters) {
  const conditions: SQL<unknown>[] = [isNull(pets.deletedAt)];

  if (filters.status !== undefined) {
    conditions.push(eq(pets.status, filters.status));
  }

  if (filters.search !== undefined) {
    const pattern = `%${filters.search}%`;
    conditions.push(or(ilike(pets.name, pattern), ilike(pets.description, pattern))!);
  }

  if (filters.cursor !== undefined) {
    conditions.push(lt(pets.createdAt, filters.cursor));
  }

  return await db.query.pets.findMany({
    where: and(...conditions),
    orderBy: (pets, { desc }) => [desc(pets.createdAt)],
    limit: filters.limit,
  });
}

export async function getAdminStorePetById(db: DbExecutor, petId: string) {
  return await db.query.pets.findFirst({
    where: and(eq(pets.id, petId), isNull(pets.deletedAt)),
  });
}

export async function createStorePet(db: DbExecutor, data: Omit<typeof pets.$inferInsert, "id">) {
  const [pet] = await db
    .insert(pets)
    .values({
      ...data,
      id: randomUUID(),
    })
    .returning();

  if (!pet) throw new Error("[ERROR] Failed to create pet catalog item.");
  return pet;
}

export async function updateStorePet(
  db: DbExecutor,
  petId: string,
  data: Partial<Omit<typeof pets.$inferInsert, "id" | "createdAt" | "deletedAt">>,
) {
  const [pet] = await db
    .update(pets)
    .set({ ...data, updatedAt: sql`NOW()` })
    .where(and(eq(pets.id, petId), isNull(pets.deletedAt)))
    .returning();

  if (!pet) throw new Error(`[ERROR] Pet ${petId} not found.`);
  return pet;
}

export async function softDeleteStorePet(db: DbExecutor, petId: string) {
  const [pet] = await db
    .update(pets)
    .set({ status: "HIDDEN", deletedAt: sql`NOW()`, updatedAt: sql`NOW()` })
    .where(and(eq(pets.id, petId), isNull(pets.deletedAt)))
    .returning();

  if (!pet) throw new Error(`[ERROR] Pet ${petId} not found.`);
  return pet;
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

  await db.insert(starTransactions).values({
    id: randomUUID(),
    childId: childId,
    amount: -cost,
    type: "PET_PURCHASE",
    sourceId: newChildPet.id,
  });

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

  await db.insert(starTransactions).values({
    id: randomUUID(),
    childId: childId,
    amount: -cost,
    type: "CONTENT_UNLOCK",
    sourceId: newUnlock.id,
  });

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
