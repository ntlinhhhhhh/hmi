import { sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { db } from "../db/client.ts";
import adminRouter from "./admin.ts";
import authRouter from "./auth.ts";
import childrenRouter from "./children.ts";
import contentRouter from "./content.ts";
import petsRouter from "./pets.ts";
import preferencesRouter from "./preferences.ts";
import trackingRouter from "./tracking.ts";

const healthRouter = new Elysia().get("/health", async ({ set }) => {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      api: "up",
      database: "down",
    },
  };

  try {
    await db.execute(sql`SELECT 1`);
    health.services.database = "up";
    set.status = 200;
  } catch (error) {
    console.error("[HEALTH] Database connection failed:", error);
    health.status = "unhealthy";
    set.status = 503;
  }

  return health;
});

const app = new Elysia()
  .use(healthRouter)
  .use(authRouter)
  .use(childrenRouter)
  .use(preferencesRouter)
  .use(contentRouter)
  .use(petsRouter)
  .use(trackingRouter)
  .use(adminRouter);

export default app;
