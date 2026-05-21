import { Elysia } from "elysia";

const healthRouter = new Elysia().get("/health", () => {
  return {
    status: "healthy",
    timestamp: new Date().toISOString()
  };
});

const app = new Elysia()
  .use(healthRouter)

export default app;