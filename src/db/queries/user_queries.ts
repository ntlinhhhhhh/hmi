import { eq, or, and, sql } from "drizzle-orm";
import type { DbExecutor } from "../client";
import { users, passwordResetCodes } from "../schema";
import { randomUUID } from "crypto";

export async function findUserByIdentifier(db: DbExecutor, identifier: string) {
  return await db.query.users.findFirst({
    where: or(eq(users.email, identifier), eq(users.phoneNumber, identifier)),
  });
}

export async function getUserById(db: DbExecutor, userId: string) {
  return await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
}

export async function createUser(
  db: DbExecutor,
  data: Omit<typeof users.$inferInsert, "id">,
) {
  const [newUser] = await db
    .insert(users)
    .values({
      ...data,
      id: randomUUID(),
    })
    .returning();

  if (!newUser)
    throw new Error("[ERROR] Database returned no data after insert.");
  return newUser;
}

export async function updateUserProfile(
  db: DbExecutor,
  userId: string,
  data: Partial<Omit<typeof users.$inferInsert, "id" | "createdAt">>,
) {
  const [updatedUser] = await db
    .update(users)
    .set({ ...data, updatedAt: sql`NOW()` })
    .where(eq(users.id, userId))
    .returning();

  if (!updatedUser) throw new Error(`[ERROR] User ${userId} not found.`);
  return updatedUser;
}

export async function markUserLoggedIn(db: DbExecutor, userId: string) {
  const [updatedUser] = await db
    .update(users)
    .set({ lastLoginAt: sql`NOW()`, updatedAt: sql`NOW()` })
    .where(eq(users.id, userId))
    .returning();

  if (!updatedUser) throw new Error(`[ERROR] User ${userId} not found.`);
  return updatedUser;
}

export async function createPasswordResetCode(
  db: DbExecutor,
  data: Omit<typeof passwordResetCodes.$inferInsert, "id">,
) {
  const [resetCode] = await db
    .insert(passwordResetCodes)
    .values({
      ...data,
      id: randomUUID(),
    })
    .returning();

  if (!resetCode) throw new Error("[ERROR] Failed to insert reset code.");
  return resetCode;
}

export async function findValidResetCode(db: DbExecutor, codeHash: string) {
  return await db.query.passwordResetCodes.findFirst({
    where: and(
      eq(passwordResetCodes.codeHash, codeHash),
      sql`expires_at > NOW()`,
      sql`used_at IS NULL`,
    ),
  });
}

export async function updatePasswordTx(
  db: DbExecutor,
  userId: string,
  newPasswordHash: string,
  resetCodeId: string,
) {
  await db
    .update(users)
    .set({ passwordHash: newPasswordHash, updatedAt: sql`NOW()` })
    .where(eq(users.id, userId));

  await db
    .update(passwordResetCodes)
    .set({ usedAt: sql`NOW()` })
    .where(eq(passwordResetCodes.id, resetCodeId));
}
