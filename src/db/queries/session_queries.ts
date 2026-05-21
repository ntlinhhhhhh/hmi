import { and, eq, gt, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { DbExecutor } from "../client";
import { sessions, users } from "../schema";

export async function createSession(
  db: DbExecutor,
  data: Omit<typeof sessions.$inferInsert, "id">,
) {
  const [session] = await db
    .insert(sessions)
    .values({
      ...data,
      id: randomUUID(),
    })
    .returning();

  if (!session) throw new Error("[ERROR] Failed to create session.");
  return session;
}

export async function getActiveSessionByTokenHash(
  db: DbExecutor,
  sessionTokenHash: string,
) {
  const [session] = await db
    .select({
      id: sessions.id,
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
      user: {
        id: users.id,
        email: users.email,
        phoneNumber: users.phoneNumber,
        fullName: users.fullName,
        role: users.role,
        status: users.status,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.sessionTokenHash, sessionTokenHash),
        gt(sessions.expiresAt, sql`NOW()`),
      ),
    )
    .limit(1);

  return session ?? null;
}

export async function touchSession(db: DbExecutor, sessionId: string) {
  const [session] = await db
    .update(sessions)
    .set({ lastUsedAt: sql`NOW()` })
    .where(eq(sessions.id, sessionId))
    .returning();

  if (!session) throw new Error(`[ERROR] Session ${sessionId} not found.`);
  return session;
}

export async function deleteSessionByTokenHash(
  db: DbExecutor,
  sessionTokenHash: string,
): Promise<boolean> {
  const deletedSessions = await db
    .delete(sessions)
    .where(eq(sessions.sessionTokenHash, sessionTokenHash))
    .returning({ id: sessions.id });

  return deletedSessions.length > 0;
}
