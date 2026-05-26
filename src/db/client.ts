import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as relations from "./relations";

const DEFAULT_POOL_SIZE = 30;

function readPoolSize(): number {
  const rawPoolSize = process.env["PG_POOL_SIZE"]?.trim();
  if (!rawPoolSize) return DEFAULT_POOL_SIZE;

  const parsedPoolSize = Number(rawPoolSize);
  if (!Number.isInteger(parsedPoolSize) || parsedPoolSize < 1) {
    throw new Error("PG_POOL_SIZE must be a positive integer.");
  }

  return parsedPoolSize;
}

function describeDatabaseTarget(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    const port = url.port || "5432";
    return `${url.hostname}:${port}${url.pathname}`;
  } catch {
    return "[configured PostgreSQL URL]";
  }
}

const poolSize = readPoolSize();

type QueryClient = ReturnType<typeof postgres>;

type DatabaseConnection = {
  databaseUrl: string;
  queryClient: QueryClient;
};

function buildDatabaseUrlFromParams(): string {
  const host = process.env["POSTGRES_HOST"] || "localhost";
  const dbName = process.env["POSTGRES_DB"];
  const port = process.env["POSTGRES_PORT"] || "5432";
  const user = process.env["POSTGRES_USER"];
  const password = process.env["POSTGRES_PASSWORD"];

  if (!dbName || !user || !password) {
    const missingVars: string[] = [];
    if (!dbName) missingVars.push("POSTGRES_DB");
    if (!user) missingVars.push("POSTGRES_USER");
    if (!password) missingVars.push("POSTGRES_PASSWORD");

    throw new Error(
      `Missing required PostgreSQL environment variables: ${missingVars.join(", ")}.`,
    );
  }

  // postgres://user:password@host:port/dbname
  const databaseUrl = new URL("postgres://localhost");
  databaseUrl.hostname = host;
  databaseUrl.port = port;
  databaseUrl.username = user;
  databaseUrl.password = password;
  databaseUrl.pathname = `/${dbName}`;

  return databaseUrl.toString();
}

async function closeQueryClient(queryClient: QueryClient): Promise<void> {
  try {
    await queryClient.end({ timeout: 5 });
  } catch (error) {
    console.error("[WARN] Failed to close unsuccessful PostgreSQL client:", error);
  }
}

async function connect(databaseUrl: string): Promise<QueryClient> {
  const queryClient = postgres(databaseUrl, { max: poolSize });

  try {
    await queryClient`SELECT 1`;
    console.log(`[INFO] PostgreSQL connection established: ${describeDatabaseTarget(databaseUrl)}`);
    return queryClient;
  } catch (error) {
    await closeQueryClient(queryClient);
    throw error;
  }
}

async function createDatabaseConnection(): Promise<DatabaseConnection> {
  const envDatabaseUrl = process.env["POSTGRES_DATABASE_URL"]?.trim();

  if (envDatabaseUrl) {
    try {
      return {
        databaseUrl: envDatabaseUrl,
        queryClient: await connect(envDatabaseUrl),
      };
    } catch (error) {
      console.error(
        "[WARN] Failed to connect using POSTGRES_DATABASE_URL. Falling back to POSTGRES_* parameters:",
        error,
      );
    }
  }

  const databaseUrl = buildDatabaseUrlFromParams();

  return {
    databaseUrl,
    queryClient: await connect(databaseUrl),
  };
}

function exitOnConnectionError(error: unknown): never {
  console.error("[ERROR] Failed to connect to PostgreSQL:", error);
  process.exit(1);
}

const connection = await createDatabaseConnection().catch(exitOnConnectionError);

export const DATABASE_URL = connection.databaseUrl;
export const queryClient = connection.queryClient;

export const db = drizzle(queryClient, { schema: { ...schema, ...relations } });

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbExecutor = typeof db | DbTransaction;

export async function withTx<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T> {
  return await db.transaction(async (tx) => {
    return await fn(tx);
  });
}

// Remove legacy sensory-regulation storage from older local databases.
try {
  await queryClient`DROP TABLE IF EXISTS "regulation_events"`;
} catch (error) {
  console.error("[ERROR] Failed to drop legacy regulation_events table:", error);
}

// Ensure device_tokens table exists
try {
  await queryClient`
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
    )
  `;
  await queryClient`
    CREATE INDEX IF NOT EXISTS "idx_device_tokens_user_id"
      ON "device_tokens" USING btree ("user_id" uuid_ops ASC NULLS LAST)
  `;
} catch (error) {
  console.error("[ERROR] Failed to ensure device_tokens table exists:", error);
}

// Ensure chatbot warning alert history exists
try {
  await queryClient`
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
    )
  `;
  await queryClient`
    CREATE INDEX IF NOT EXISTS "idx_alerts_child_id_created_at"
      ON "alerts" USING btree ("child_id" uuid_ops ASC NULLS LAST, "created_at" timestamptz_ops DESC NULLS FIRST)
  `;
} catch (error) {
  console.error("[ERROR] Failed to ensure alerts table exists:", error);
}

// Ensure webcam_consent column exists in child_profiles
try {
  await queryClient`
    ALTER TABLE "child_profiles" ADD COLUMN IF NOT EXISTS "webcam_consent" boolean DEFAULT false NOT NULL
  `;
} catch (error) {
  console.error("[ERROR] Failed to ensure webcam_consent column exists in child_profiles:", error);
}

// Ensure star_transactions table exists
try {
  await queryClient`
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
    )
  `;
  await queryClient`
    CREATE INDEX IF NOT EXISTS "idx_star_transactions_child_id_created_at"
      ON "star_transactions" USING btree ("child_id" uuid_ops ASC NULLS LAST, "created_at" timestamptz_ops DESC NULLS FIRST)
  `;
} catch (error) {
  console.error("[ERROR] Failed to ensure star_transactions table exists:", error);
}

// Ensure media_assets table exists
try {
  await queryClient`
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
    )
  `;
  await queryClient`
    CREATE INDEX IF NOT EXISTS "idx_media_assets_created_by"
      ON "media_assets" USING btree ("created_by" uuid_ops ASC NULLS LAST)
  `;
} catch (error) {
  console.error("[ERROR] Failed to ensure media_assets table exists:", error);
}
