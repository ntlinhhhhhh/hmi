import { eq, and, desc, lt, ilike, type SQL, sql } from "drizzle-orm";
import type { DbExecutor } from "../client";
import { contents, lectures, quizzes, game } from "../schema";
import { randomUUID } from "crypto";

export type AdminContentListFilters = {
  type?: string;
  status?: string;
  search?: string;
  cursor?: string;
  limit: number;
};

export async function listAdminContentRows(db: DbExecutor, filters: AdminContentListFilters) {
  const conditions: SQL<unknown>[] = [];

  if (filters.type !== undefined) {
    conditions.push(eq(contents.type, filters.type));
  }
  if (filters.status !== undefined) {
    conditions.push(eq(contents.status, filters.status));
  }
  if (filters.search !== undefined) {
    conditions.push(ilike(contents.title, `%${filters.search}%`));
  }
  if (filters.cursor !== undefined) {
    conditions.push(lt(contents.createdAt, filters.cursor));
  }

  return await db.query.contents.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      lecture: true,
      quiz: true,
      game: true,
    },
    orderBy: [desc(contents.createdAt)],
    limit: filters.limit,
  });
}

export async function getAdminContentDetailRow(db: DbExecutor, contentId: string) {
  return await db.query.contents.findFirst({
    where: eq(contents.id, contentId),
    with: {
      lecture: true,
      quiz: true,
      game: true,
    },
  });
}

export async function createAdminContentRow(
  db: DbExecutor,
  baseData: Omit<typeof contents.$inferInsert, "id">,
  typeData: any,
) {
  const id = randomUUID();
  const [newContent] = await db
    .insert(contents)
    .values({
      ...baseData,
      id,
    })
    .returning();

  if (!newContent) throw new Error("Failed to insert content.");

  if (baseData.type === "LECTURE") {
    await db.insert(lectures).values({
      ...typeData,
      id,
    });
  } else if (baseData.type === "QUIZ") {
    await db.insert(quizzes).values({
      ...typeData,
      id,
    });
  } else if (baseData.type === "GAME") {
    await db.insert(game).values({
      ...typeData,
      id,
    });
  }

  return await getAdminContentDetailRow(db, id);
}

export async function updateAdminContentRow(
  db: DbExecutor,
  contentId: string,
  baseData: Partial<Omit<typeof contents.$inferInsert, "id" | "type">>,
  typeData: any,
) {
  if (Object.keys(baseData).length > 0) {
    await db
      .update(contents)
      .set({
        ...baseData,
        updatedAt: sql`NOW()`,
      })
      .where(eq(contents.id, contentId));
  }

  const current = await db.query.contents.findFirst({
    where: eq(contents.id, contentId),
  });
  if (!current) throw new Error("Content not found.");

  if (Object.keys(typeData).length > 0) {
    if (current.type === "LECTURE") {
      await db
        .update(lectures)
        .set(typeData)
        .where(eq(lectures.id, contentId));
    } else if (current.type === "QUIZ") {
      await db
        .update(quizzes)
        .set(typeData)
        .where(eq(quizzes.id, contentId));
    } else if (current.type === "GAME") {
      await db
        .update(game)
        .set(typeData)
        .where(eq(game.id, contentId));
    }
  }

  return await getAdminContentDetailRow(db, contentId);
}

export async function softDeleteAdminContentRow(db: DbExecutor, contentId: string) {
  const [deleted] = await db
    .update(contents)
    .set({
      deletedAt: sql`NOW()`,
      updatedAt: sql`NOW()`,
    })
    .where(eq(contents.id, contentId))
    .returning();

  return deleted;
}
