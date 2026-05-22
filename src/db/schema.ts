import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  unique,
  check,
  uuid,
  foreignKey,
  integer,
  primaryKey,
  customType,
  jsonb,
  real,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Custom Types
const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

export interface PreferencesMetadata {
  theme?: string;
  volume?: number;
  [key: string]: unknown;
}

// Tables
export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().notNull(),
    email: citext("email").notNull(),
    phoneNumber: citext("phone_number"),
    passwordHash: text("password_hash"),
    authProvider: text("auth_provider").default("LOCAL").notNull(),
    providerId: text("provider_id"),
    fullName: text("full_name"),
    role: text("role").default("PARENT").notNull(),
    status: text("status").default("ACTIVE").notNull(),
    lastLoginAt: timestamp("last_login_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_users_email").using("btree", table.email.asc().nullsLast().op("citext_ops")),
    index("idx_users_phone_number").using(
      "btree",
      table.phoneNumber.asc().nullsLast().op("citext_ops"),
    ),
    unique("users_email_key").on(table.email),
    unique("users_phone_number_key").on(table.phoneNumber),
    check("users_role_check", sql`role = ANY (ARRAY['PARENT'::text, 'ADMIN'::text])`),
    check("users_status_check", sql`status = ANY (ARRAY['ACTIVE'::text, 'BANNED'::text])`),
  ],
);

export const passwordResetCodes = pgTable(
  "password_reset_codes",
  {
    id: uuid().primaryKey().notNull(),
    userId: uuid("user_id").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    verifiedAt: timestamp("verified_at", {
      withTimezone: true,
      mode: "string",
    }),
    usedAt: timestamp("used_at", { withTimezone: true, mode: "string" }),
    attemptCount: integer("attempt_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_password_reset_codes_expires_at").using(
      "btree",
      table.expiresAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    index("idx_password_reset_codes_user_id").using(
      "btree",
      table.userId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "password_reset_codes_user_id_fkey",
    }).onDelete("cascade"),

    unique("password_reset_codes_code_hash_key").on(table.codeHash),
    check("password_reset_codes_attempt_count_check", sql`attempt_count >= 0`),
    check("password_reset_codes_expiry_check", sql`expires_at > created_at`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid().primaryKey().notNull(),
    userId: uuid("user_id").notNull(),
    sessionTokenHash: text("session_token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    lastUsedAt: timestamp("last_used_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    index("idx_sessions_expires_at").using(
      "btree",
      table.expiresAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    index("idx_sessions_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "sessions_user_id_fkey",
    }).onDelete("cascade"),
    unique("sessions_session_token_hash_key").on(table.sessionTokenHash),
    check("sessions_expiry_check", sql`expires_at > created_at`),
  ],
);

export const childProfiles = pgTable(
  "child_profiles",
  {
    id: uuid().primaryKey().notNull(),
    parentId: uuid("parent_id").notNull(),
    nickname: text("nickname").notNull(),
    avatarUrl: text("avatar_url"),
    birthYear: integer("birth_year").notNull(),
    totalStars: integer("total_stars").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_child_profiles_parent_id").using(
      "btree",
      table.parentId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [users.id],
      name: "child_profiles_parent_id_fkey",
    }).onDelete("cascade"),
    check("child_profiles_stars_check", sql`total_stars >= 0`),
  ],
);

export const preferences = pgTable(
  "preferences",
  {
    childId: uuid("child_id").primaryKey().notNull(),
    isHighContrast: boolean("is_high_contrast").default(false).notNull(),
    preferencesData: jsonb("preferences").$type<PreferencesMetadata>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.childId],
      foreignColumns: [childProfiles.id],
      name: "preferences_child_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const emotionLogs = pgTable(
  "emotion_logs",
  {
    id: uuid().primaryKey().notNull(),
    childId: uuid("child_id").notNull(),
    emotionValue: text("emotion_value").notNull(),
    triggerSource: text("trigger_source").notNull(),
    durationSeconds: integer("duration_seconds"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_emotion_logs_child_id_created_at").using(
      "btree",
      table.childId.asc().nullsLast().op("uuid_ops"),
      table.createdAt.desc().nullsFirst().op("timestamptz_ops"),
    ),
    foreignKey({
      columns: [table.childId],
      foreignColumns: [childProfiles.id],
      name: "emotion_logs_child_id_fkey",
    }).onDelete("cascade"),
    check("emotion_logs_duration_check", sql`duration_seconds > 0 OR duration_seconds IS NULL`),
  ],
);

export const contents = pgTable(
  "contents",
  {
    id: uuid().primaryKey().notNull(),
    title: text("title").notNull(),
    type: text("type").notNull(),
    status: text("status").default("DRAFT").notNull(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("idx_contents_status_deleted_at").using(
      "btree",
      table.status.asc().nullsLast().op("text_ops"),
      table.deletedAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: "contents_created_by_fkey",
    }).onDelete("set null"),
    check(
      "contents_type_check",
      sql`type = ANY (ARRAY['LECTURE'::text, 'GAME'::text, 'QUIZ'::text])`,
    ),
    check("contents_status_check", sql`status = ANY (ARRAY['DRAFT'::text, 'PUBLISHED'::text])`),
  ],
);

export const lectures = pgTable(
  "lectures",
  {
    id: uuid().primaryKey().notNull(),
    mediaUrl: text("media_url"),
    description: text("description"),
    difficultyLevel: integer("difficulty_level").default(1).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [contents.id],
      name: "lectures_id_contents_fkey",
    }).onDelete("cascade"),
    check("lectures_difficulty_check", sql`difficulty_level >= 1 AND difficulty_level <= 3`),
  ],
);

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid().primaryKey().notNull(),
    mediaUrl: text("media_url"),
    description: text("description"),
    difficultyLevel: integer("difficulty_level").default(1).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    correctEmotion: text("correct_emotion").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [contents.id],
      name: "quizzes_id_contents_fkey",
    }).onDelete("cascade"),
    check("quizzes_difficulty_check", sql`difficulty_level >= 1 AND difficulty_level <= 3`),
  ],
);

export const game = pgTable(
  "game",
  {
    id: uuid().primaryKey().notNull(),
    targetEmotion: text("target_emotion").notNull(),
    timeLimitSeconds: integer("time_limit_seconds").notNull(),
    difficultyLevel: integer("difficulty_level").default(1).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    unlockStarCost: integer("unlock_star_cost").default(0).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [contents.id],
      name: "game_id_contents_fkey",
    }).onDelete("cascade"),
    check("game_difficulty_check", sql`difficulty_level >= 1 AND difficulty_level <= 3`),
    check("game_star_cost_check", sql`unlock_star_cost >= 0`),
    check("game_time_limit_check", sql`time_limit_seconds > 0`),
  ],
);

export const unlockContent = pgTable(
  "unlock_content",
  {
    id: uuid().primaryKey().notNull(),
    childId: uuid("child_id").notNull(),
    contentId: uuid("content_id").notNull(),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_unlock_content_child_id").using(
      "btree",
      table.childId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.childId],
      foreignColumns: [childProfiles.id],
      name: "unlock_content_child_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.contentId],
      foreignColumns: [contents.id],
      name: "unlock_content_content_id_fkey",
    }).onDelete("cascade"),
    unique("unlock_content_unique_pair").on(table.childId, table.contentId),
  ],
);

export const contentSessions = pgTable(
  "content_sessions",
  {
    id: uuid().primaryKey().notNull(),
    childId: uuid("child_id").notNull(),
    unlockContentId: uuid("unlock_content_id").notNull(),
    durationSeconds: integer("duration_seconds"),
    isCorrect: boolean("is_correct"),
    starsEarned: integer("stars_earned").default(0).notNull(),
    aiMatchScore: real("ai_match_score"),
    status: text("status").default("COMPLETED").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_content_sessions_child_id_created_at").using(
      "btree",
      table.childId.asc().nullsLast().op("uuid_ops"),
      table.createdAt.desc().nullsFirst().op("timestamptz_ops"),
    ),
    uniqueIndex("content_sessions_one_reward_per_content_idx")
      .on(table.childId, table.unlockContentId)
      .where(sql`status = 'COMPLETED' AND stars_earned > 0`),
    foreignKey({
      columns: [table.childId],
      foreignColumns: [childProfiles.id],
      name: "content_sessions_child_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.unlockContentId],
      foreignColumns: [unlockContent.id],
      name: "content_sessions_unlock_id_fkey",
    }).onDelete("cascade"),
    check(
      "content_sessions_status_check",
      sql`status = ANY (ARRAY['COMPLETED'::text, 'ABANDONED'::text])`,
    ),
    check("content_sessions_stars_check", sql`stars_earned >= 0`),
  ],
);

export const pets = pgTable(
  "pets",
  {
    id: uuid().primaryKey().notNull(),
    name: text("name").notNull(),
    description: text("description"),
    imageUrl: text("image_url").notNull(),
    animationUrl: text("animation_url"),
    unlockStarCost: integer("unlock_star_cost").default(0).notNull(),
    status: text("status").default("ACTIVE").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("idx_pets_status_deleted_at").using(
      "btree",
      table.status.asc().nullsLast().op("text_ops"),
      table.deletedAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    check("pets_status_check", sql`status = ANY (ARRAY['ACTIVE'::text, 'HIDDEN'::text])`),
    check("pets_star_cost_check", sql`unlock_star_cost >= 0`),
  ],
);

export const childPets = pgTable(
  "child_pets",
  {
    id: uuid().primaryKey().notNull(),
    childId: uuid("child_id").notNull(),
    petId: uuid("pet_id").notNull(),
    customName: text("custom_name"),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_child_pets_child_id").using("btree", table.childId.asc().nullsLast().op("uuid_ops")),
    foreignKey({
      columns: [table.childId],
      foreignColumns: [childProfiles.id],
      name: "child_pets_child_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.petId],
      foreignColumns: [pets.id],
      name: "child_pets_pet_id_fkey",
    }).onDelete("cascade"),
    unique("child_pets_unique_pair").on(table.childId, table.petId),
  ],
);
