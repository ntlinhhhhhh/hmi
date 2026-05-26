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
  "confidence_score" real,
  "ai_emotion_label" text,
  "ai_confidence" real,
  "ai_scores" jsonb,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "emotion_logs_child_id_fkey"
    FOREIGN KEY ("child_id") REFERENCES "child_profiles" ("id") ON DELETE cascade,
  CONSTRAINT "emotion_logs_duration_check"
    CHECK ("duration_seconds" > 0 OR "duration_seconds" IS NULL),
  CONSTRAINT "emotion_logs_confidence_score_check"
    CHECK ("confidence_score" IS NULL OR ("confidence_score" >= 0 AND "confidence_score" <= 1)),
  CONSTRAINT "emotion_logs_ai_confidence_check"
    CHECK ("ai_confidence" IS NULL OR ("ai_confidence" >= 0 AND "ai_confidence" <= 1)),
  CONSTRAINT "emotion_logs_ai_scores_object_check"
    CHECK ("ai_scores" IS NULL OR jsonb_typeof("ai_scores") = 'object'),
  CONSTRAINT "emotion_logs_metadata_object_check"
    CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object')
);

ALTER TABLE "emotion_logs"
  ADD COLUMN IF NOT EXISTS "confidence_score" real,
  ADD COLUMN IF NOT EXISTS "ai_emotion_label" text,
  ADD COLUMN IF NOT EXISTS "ai_confidence" real,
  ADD COLUMN IF NOT EXISTS "ai_scores" jsonb,
  ADD COLUMN IF NOT EXISTS "metadata" jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'emotion_logs_confidence_score_check'
  ) THEN
    ALTER TABLE "emotion_logs"
      ADD CONSTRAINT "emotion_logs_confidence_score_check"
      CHECK ("confidence_score" IS NULL OR ("confidence_score" >= 0 AND "confidence_score" <= 1));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'emotion_logs_ai_confidence_check'
  ) THEN
    ALTER TABLE "emotion_logs"
      ADD CONSTRAINT "emotion_logs_ai_confidence_check"
      CHECK ("ai_confidence" IS NULL OR ("ai_confidence" >= 0 AND "ai_confidence" <= 1));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'emotion_logs_ai_scores_object_check'
  ) THEN
    ALTER TABLE "emotion_logs"
      ADD CONSTRAINT "emotion_logs_ai_scores_object_check"
      CHECK ("ai_scores" IS NULL OR jsonb_typeof("ai_scores") = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'emotion_logs_metadata_object_check'
  ) THEN
    ALTER TABLE "emotion_logs"
      ADD CONSTRAINT "emotion_logs_metadata_object_check"
      CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_emotion_logs_child_id_created_at"
  ON "emotion_logs" USING btree (
    "child_id" uuid_ops ASC NULLS LAST,
    "created_at" timestamptz_ops DESC NULLS FIRST
  );

DROP TABLE IF EXISTS "regulation_events";

CREATE TABLE IF NOT EXISTS "alerts" (
  "id" uuid PRIMARY KEY NOT NULL,
  "child_id" uuid NOT NULL,
  "reason" text NOT NULL,
  "source" text DEFAULT 'CHATBOT' NOT NULL,
  "notification_status" text DEFAULT 'PENDING' NOT NULL,
  "notification_sent_at" timestamp with time zone,
  "notification_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "alerts_child_id_fkey"
    FOREIGN KEY ("child_id") REFERENCES "child_profiles" ("id") ON DELETE cascade,
  CONSTRAINT "alerts_reason_length_check"
    CHECK (char_length("reason") > 0 AND char_length("reason") <= 1000),
  CONSTRAINT "alerts_source_check" CHECK ("source" = 'CHATBOT'::text),
  CONSTRAINT "alerts_notification_status_check"
    CHECK ("notification_status" = ANY (ARRAY['PENDING'::text, 'SENT'::text, 'FAILED'::text, 'NO_DEVICES'::text]))
);

CREATE INDEX IF NOT EXISTS "idx_alerts_child_id_created_at"
  ON "alerts" USING btree (
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
  "deleted_at" timestamp with time zone,
  CONSTRAINT "contents_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE set null,
  CONSTRAINT "contents_type_check"
    CHECK ("type" = ANY (ARRAY['LECTURE'::text, 'GAME'::text, 'QUIZ'::text])),
  CONSTRAINT "contents_status_check"
    CHECK ("status" = ANY (ARRAY['DRAFT'::text, 'PUBLISHED'::text]))
);

ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "idx_contents_status_deleted_at"
  ON "contents" USING btree (
    "status" text_ops ASC NULLS LAST,
    "deleted_at" timestamptz_ops ASC NULLS LAST
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
  "answer_emotions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "correct_emotion" text NOT NULL,
  CONSTRAINT "quizzes_id_contents_fkey"
    FOREIGN KEY ("id") REFERENCES "contents" ("id") ON DELETE cascade,
  CONSTRAINT "quizzes_difficulty_check"
    CHECK ("difficulty_level" >= 1 AND "difficulty_level" <= 3),
  CONSTRAINT "quizzes_answer_emotions_array_check"
    CHECK (jsonb_typeof("answer_emotions") = 'array')
);

ALTER TABLE "quizzes"
  ADD COLUMN IF NOT EXISTS "answer_emotions" jsonb DEFAULT '[]'::jsonb NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quizzes_answer_emotions_array_check'
  ) THEN
    ALTER TABLE "quizzes"
      ADD CONSTRAINT "quizzes_answer_emotions_array_check"
      CHECK (jsonb_typeof("answer_emotions") = 'array');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "game" (
  "id" uuid PRIMARY KEY NOT NULL,
  "target_emotion" text NOT NULL,
  "time_limit_seconds" integer NOT NULL,
  "difficulty_level" integer DEFAULT 1 NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "unlock_star_cost" integer DEFAULT 0 NOT NULL,
  "prompt_asset_type" text,
  "prompt_asset_url" text,
  CONSTRAINT "game_id_contents_fkey"
    FOREIGN KEY ("id") REFERENCES "contents" ("id") ON DELETE cascade,
  CONSTRAINT "game_difficulty_check"
    CHECK ("difficulty_level" >= 1 AND "difficulty_level" <= 3),
  CONSTRAINT "game_star_cost_check" CHECK ("unlock_star_cost" >= 0),
  CONSTRAINT "game_time_limit_check" CHECK ("time_limit_seconds" > 0),
  CONSTRAINT "game_prompt_asset_type_check"
    CHECK (
      "prompt_asset_type" IS NULL
      OR "prompt_asset_type" = ANY (ARRAY['ICON'::text, 'IMAGE'::text, 'VIDEO'::text])
    )
);

ALTER TABLE "game"
  ADD COLUMN IF NOT EXISTS "prompt_asset_type" text,
  ADD COLUMN IF NOT EXISTS "prompt_asset_url" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'game_prompt_asset_type_check'
  ) THEN
    ALTER TABLE "game"
      ADD CONSTRAINT "game_prompt_asset_type_check"
      CHECK (
        "prompt_asset_type" IS NULL
        OR "prompt_asset_type" = ANY (ARRAY['ICON'::text, 'IMAGE'::text, 'VIDEO'::text])
      );
  END IF;
END $$;

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
  "selected_emotion" text,
  "idempotency_key" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "ai_detected_emotion" text,
  "ai_confidence" real,
  "ai_scores" jsonb,
  "metadata" jsonb,
  "status" text DEFAULT 'COMPLETED' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "content_sessions_child_id_fkey"
    FOREIGN KEY ("child_id") REFERENCES "child_profiles" ("id") ON DELETE cascade,
  CONSTRAINT "content_sessions_unlock_id_fkey"
    FOREIGN KEY ("unlock_content_id") REFERENCES "unlock_content" ("id") ON DELETE cascade,
  CONSTRAINT "content_sessions_status_check"
    CHECK ("status" = ANY (ARRAY['COMPLETED'::text, 'ABANDONED'::text])),
  CONSTRAINT "content_sessions_stars_check" CHECK ("stars_earned" >= 0),
  CONSTRAINT "content_sessions_duration_check"
    CHECK ("duration_seconds" IS NULL OR "duration_seconds" > 0),
  CONSTRAINT "content_sessions_time_check"
    CHECK (
      "completed_at" IS NULL
      OR "started_at" IS NULL
      OR "completed_at" >= "started_at"
    ),
  CONSTRAINT "content_sessions_ai_confidence_check"
    CHECK ("ai_confidence" IS NULL OR ("ai_confidence" >= 0 AND "ai_confidence" <= 1)),
  CONSTRAINT "content_sessions_ai_scores_object_check"
    CHECK ("ai_scores" IS NULL OR jsonb_typeof("ai_scores") = 'object'),
  CONSTRAINT "content_sessions_metadata_object_check"
    CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object')
);

ALTER TABLE "content_sessions"
  ADD COLUMN IF NOT EXISTS "selected_emotion" text,
  ADD COLUMN IF NOT EXISTS "idempotency_key" text,
  ADD COLUMN IF NOT EXISTS "started_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "ai_detected_emotion" text,
  ADD COLUMN IF NOT EXISTS "ai_confidence" real,
  ADD COLUMN IF NOT EXISTS "ai_scores" jsonb,
  ADD COLUMN IF NOT EXISTS "metadata" jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_sessions_duration_check'
  ) THEN
    ALTER TABLE "content_sessions"
      ADD CONSTRAINT "content_sessions_duration_check"
      CHECK ("duration_seconds" IS NULL OR "duration_seconds" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_sessions_time_check'
  ) THEN
    ALTER TABLE "content_sessions"
      ADD CONSTRAINT "content_sessions_time_check"
      CHECK (
        "completed_at" IS NULL
        OR "started_at" IS NULL
        OR "completed_at" >= "started_at"
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_sessions_ai_confidence_check'
  ) THEN
    ALTER TABLE "content_sessions"
      ADD CONSTRAINT "content_sessions_ai_confidence_check"
      CHECK ("ai_confidence" IS NULL OR ("ai_confidence" >= 0 AND "ai_confidence" <= 1));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_sessions_ai_scores_object_check'
  ) THEN
    ALTER TABLE "content_sessions"
      ADD CONSTRAINT "content_sessions_ai_scores_object_check"
      CHECK ("ai_scores" IS NULL OR jsonb_typeof("ai_scores") = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_sessions_metadata_object_check'
  ) THEN
    ALTER TABLE "content_sessions"
      ADD CONSTRAINT "content_sessions_metadata_object_check"
      CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_content_sessions_child_id_created_at"
  ON "content_sessions" USING btree (
    "child_id" uuid_ops ASC NULLS LAST,
    "created_at" timestamptz_ops DESC NULLS FIRST
  );

CREATE UNIQUE INDEX IF NOT EXISTS "content_sessions_one_reward_per_content_idx"
  ON "content_sessions" USING btree ("child_id", "unlock_content_id")
  WHERE "status" = 'COMPLETED' AND "stars_earned" > 0;

CREATE UNIQUE INDEX IF NOT EXISTS "content_sessions_child_idempotency_key_idx"
  ON "content_sessions" USING btree ("child_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;

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
  "deleted_at" timestamp with time zone,
  CONSTRAINT "pets_status_check"
    CHECK ("status" = ANY (ARRAY['ACTIVE'::text, 'HIDDEN'::text])),
  CONSTRAINT "pets_star_cost_check" CHECK ("unlock_star_cost" >= 0)
);

ALTER TABLE "pets" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "idx_pets_status_deleted_at"
  ON "pets" USING btree (
    "status" text_ops ASC NULLS LAST,
    "deleted_at" timestamptz_ops ASC NULLS LAST
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

CREATE TABLE IF NOT EXISTS "device_tokens" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "platform" text NOT NULL,
  "push_token" text NOT NULL,
  "app_instance_id" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "device_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE cascade,
  CONSTRAINT "device_tokens_push_token_key" UNIQUE ("push_token"),
  CONSTRAINT "device_tokens_platform_check" CHECK ("platform" = ANY (ARRAY['WEB'::text, 'IOS'::text, 'ANDROID'::text]))
);

CREATE INDEX IF NOT EXISTS "idx_device_tokens_user_id"
  ON "device_tokens" USING btree ("user_id" uuid_ops ASC NULLS LAST);

ALTER TABLE "child_profiles" ADD COLUMN IF NOT EXISTS "webcam_consent" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "star_transactions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "child_id" uuid NOT NULL,
  "amount" integer NOT NULL,
  "type" text NOT NULL,
  "source_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "star_transactions_child_id_fkey"
    FOREIGN KEY ("child_id") REFERENCES "child_profiles" ("id") ON DELETE cascade,
  CONSTRAINT "star_transactions_type_check"
    CHECK ("type" = ANY (ARRAY['LEARNING_REWARD'::text, 'CONTENT_UNLOCK'::text, 'PET_PURCHASE'::text]))
);

CREATE INDEX IF NOT EXISTS "idx_star_transactions_child_id_created_at"
  ON "star_transactions" USING btree ("child_id" uuid_ops ASC NULLS LAST, "created_at" timestamptz_ops DESC NULLS FIRST);

CREATE TABLE IF NOT EXISTS "media_assets" (
  "id" uuid PRIMARY KEY NOT NULL,
  "file_name" text NOT NULL,
  "storage_key" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "purpose" text NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "media_assets_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "idx_media_assets_created_by"
  ON "media_assets" USING btree ("created_by" uuid_ops ASC NULLS LAST);
