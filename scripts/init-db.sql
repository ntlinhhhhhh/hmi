CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY NOT NULL,
  "email" citext NOT NULL,
  "phone_number" citext,
  "password_hash" text,
  "auth_provider" text DEFAULT 'LOCAL' NOT NULL,
  "provider_id" text,
  "full_name" text,
  "role" text DEFAULT 'PARENT' NOT NULL,
  "status" text DEFAULT 'ACTIVE' NOT NULL,
  "last_login_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_key" UNIQUE ("email"),
  CONSTRAINT "users_phone_number_key" UNIQUE ("phone_number"),
  CONSTRAINT "users_role_check" CHECK ("role" = ANY (ARRAY['PARENT'::text, 'ADMIN'::text])),
  CONSTRAINT "users_status_check" CHECK ("status" = ANY (ARRAY['ACTIVE'::text, 'BANNED'::text]))
);

CREATE INDEX IF NOT EXISTS "idx_users_email"
  ON "users" USING btree ("email" citext_ops ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS "idx_users_phone_number"
  ON "users" USING btree ("phone_number" citext_ops ASC NULLS LAST);

CREATE TABLE IF NOT EXISTS "password_reset_codes" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "code_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "verified_at" timestamp with time zone,
  "used_at" timestamp with time zone,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "password_reset_codes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE cascade,
  CONSTRAINT "password_reset_codes_code_hash_key" UNIQUE ("code_hash"),
  CONSTRAINT "password_reset_codes_attempt_count_check" CHECK ("attempt_count" >= 0),
  CONSTRAINT "password_reset_codes_expiry_check" CHECK ("expires_at" > "created_at")
);

CREATE INDEX IF NOT EXISTS "idx_password_reset_codes_expires_at"
  ON "password_reset_codes" USING btree ("expires_at" timestamptz_ops ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS "idx_password_reset_codes_user_id"
  ON "password_reset_codes" USING btree ("user_id" uuid_ops ASC NULLS LAST);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "session_token_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  CONSTRAINT "sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE cascade,
  CONSTRAINT "sessions_session_token_hash_key" UNIQUE ("session_token_hash"),
  CONSTRAINT "sessions_expiry_check" CHECK ("expires_at" > "created_at")
);

CREATE INDEX IF NOT EXISTS "idx_sessions_expires_at"
  ON "sessions" USING btree ("expires_at" timestamptz_ops ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS "idx_sessions_user_id"
  ON "sessions" USING btree ("user_id" uuid_ops ASC NULLS LAST);

CREATE TABLE IF NOT EXISTS "child_profiles" (
  "id" uuid PRIMARY KEY NOT NULL,
  "parent_id" uuid NOT NULL,
  "nickname" text NOT NULL,
  "avatar_url" text,
  "birth_year" integer NOT NULL,
  "total_stars" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "child_profiles_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "users" ("id") ON DELETE cascade,
  CONSTRAINT "child_profiles_stars_check" CHECK ("total_stars" >= 0)
);

CREATE INDEX IF NOT EXISTS "idx_child_profiles_parent_id"
  ON "child_profiles" USING btree ("parent_id" uuid_ops ASC NULLS LAST);

CREATE TABLE IF NOT EXISTS "preferences" (
  "child_id" uuid PRIMARY KEY NOT NULL,
  "is_high_contrast" boolean DEFAULT false NOT NULL,
  "preferences" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "preferences_child_id_fkey"
    FOREIGN KEY ("child_id") REFERENCES "child_profiles" ("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "emotion_logs" (
  "id" uuid PRIMARY KEY NOT NULL,
  "child_id" uuid NOT NULL,
  "emotion_value" text NOT NULL,
  "trigger_source" text NOT NULL,
  "duration_seconds" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "emotion_logs_child_id_fkey"
    FOREIGN KEY ("child_id") REFERENCES "child_profiles" ("id") ON DELETE cascade,
  CONSTRAINT "emotion_logs_duration_check"
    CHECK ("duration_seconds" > 0 OR "duration_seconds" IS NULL)
);

CREATE INDEX IF NOT EXISTS "idx_emotion_logs_child_id_created_at"
  ON "emotion_logs" USING btree (
    "child_id" uuid_ops ASC NULLS LAST,
    "created_at" timestamptz_ops DESC NULLS FIRST
  );

CREATE TABLE IF NOT EXISTS "contents" (
  "id" uuid PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "type" text NOT NULL,
  "status" text DEFAULT 'DRAFT' NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "contents_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE set null,
  CONSTRAINT "contents_type_check"
    CHECK ("type" = ANY (ARRAY['LECTURE'::text, 'GAME'::text, 'QUIZ'::text])),
  CONSTRAINT "contents_status_check"
    CHECK ("status" = ANY (ARRAY['DRAFT'::text, 'PUBLISHED'::text]))
);

CREATE TABLE IF NOT EXISTS "lectures" (
  "id" uuid PRIMARY KEY NOT NULL,
  "media_url" text,
  "description" text,
  "difficulty_level" integer DEFAULT 1 NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  CONSTRAINT "lectures_id_contents_fkey"
    FOREIGN KEY ("id") REFERENCES "contents" ("id") ON DELETE cascade,
  CONSTRAINT "lectures_difficulty_check"
    CHECK ("difficulty_level" >= 1 AND "difficulty_level" <= 3)
);

CREATE TABLE IF NOT EXISTS "quizzes" (
  "id" uuid PRIMARY KEY NOT NULL,
  "media_url" text,
  "description" text,
  "difficulty_level" integer DEFAULT 1 NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "correct_emotion" text NOT NULL,
  CONSTRAINT "quizzes_id_contents_fkey"
    FOREIGN KEY ("id") REFERENCES "contents" ("id") ON DELETE cascade,
  CONSTRAINT "quizzes_difficulty_check"
    CHECK ("difficulty_level" >= 1 AND "difficulty_level" <= 3)
);

CREATE TABLE IF NOT EXISTS "game" (
  "id" uuid PRIMARY KEY NOT NULL,
  "target_emotion" text NOT NULL,
  "time_limit_seconds" integer NOT NULL,
  "difficulty_level" integer DEFAULT 1 NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "unlock_star_cost" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "game_id_contents_fkey"
    FOREIGN KEY ("id") REFERENCES "contents" ("id") ON DELETE cascade,
  CONSTRAINT "game_difficulty_check"
    CHECK ("difficulty_level" >= 1 AND "difficulty_level" <= 3),
  CONSTRAINT "game_star_cost_check" CHECK ("unlock_star_cost" >= 0),
  CONSTRAINT "game_time_limit_check" CHECK ("time_limit_seconds" > 0)
);

CREATE TABLE IF NOT EXISTS "unlock_content" (
  "id" uuid PRIMARY KEY NOT NULL,
  "child_id" uuid NOT NULL,
  "content_id" uuid NOT NULL,
  "unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "unlock_content_child_id_fkey"
    FOREIGN KEY ("child_id") REFERENCES "child_profiles" ("id") ON DELETE cascade,
  CONSTRAINT "unlock_content_content_id_fkey"
    FOREIGN KEY ("content_id") REFERENCES "contents" ("id") ON DELETE cascade,
  CONSTRAINT "unlock_content_unique_pair" UNIQUE ("child_id", "content_id")
);

CREATE INDEX IF NOT EXISTS "idx_unlock_content_child_id"
  ON "unlock_content" USING btree ("child_id" uuid_ops ASC NULLS LAST);

CREATE TABLE IF NOT EXISTS "content_sessions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "child_id" uuid NOT NULL,
  "unlock_content_id" uuid NOT NULL,
  "duration_seconds" integer,
  "is_correct" boolean,
  "stars_earned" integer DEFAULT 0 NOT NULL,
  "ai_match_score" real,
  "status" text DEFAULT 'COMPLETED' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "content_sessions_child_id_fkey"
    FOREIGN KEY ("child_id") REFERENCES "child_profiles" ("id") ON DELETE cascade,
  CONSTRAINT "content_sessions_unlock_id_fkey"
    FOREIGN KEY ("unlock_content_id") REFERENCES "unlock_content" ("id") ON DELETE cascade,
  CONSTRAINT "content_sessions_status_check"
    CHECK ("status" = ANY (ARRAY['COMPLETED'::text, 'ABANDONED'::text])),
  CONSTRAINT "content_sessions_stars_check" CHECK ("stars_earned" >= 0)
);

CREATE INDEX IF NOT EXISTS "idx_content_sessions_child_id_created_at"
  ON "content_sessions" USING btree (
    "child_id" uuid_ops ASC NULLS LAST,
    "created_at" timestamptz_ops DESC NULLS FIRST
  );

CREATE TABLE IF NOT EXISTS "pets" (
  "id" uuid PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "image_url" text NOT NULL,
  "animation_url" text,
  "unlock_star_cost" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'ACTIVE' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "pets_status_check"
    CHECK ("status" = ANY (ARRAY['ACTIVE'::text, 'HIDDEN'::text])),
  CONSTRAINT "pets_star_cost_check" CHECK ("unlock_star_cost" >= 0)
);

CREATE TABLE IF NOT EXISTS "child_pets" (
  "id" uuid PRIMARY KEY NOT NULL,
  "child_id" uuid NOT NULL,
  "pet_id" uuid NOT NULL,
  "custom_name" text,
  "unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "child_pets_child_id_fkey"
    FOREIGN KEY ("child_id") REFERENCES "child_profiles" ("id") ON DELETE cascade,
  CONSTRAINT "child_pets_pet_id_fkey"
    FOREIGN KEY ("pet_id") REFERENCES "pets" ("id") ON DELETE cascade,
  CONSTRAINT "child_pets_unique_pair" UNIQUE ("child_id", "pet_id")
);

CREATE INDEX IF NOT EXISTS "idx_child_pets_child_id"
  ON "child_pets" USING btree ("child_id" uuid_ops ASC NULLS LAST);
