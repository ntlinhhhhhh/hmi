import { Elysia } from "elysia";
import { requireAuth } from "./require_auth.ts";
import { AppError } from "../../usecases/app_error.ts";

export const requireAdmin = new Elysia()
  .use(requireAuth)
  .resolve({ as: "scoped" }, async ({ authUserId, authUser }) => {
    if (!authUser || !authUserId) {
      throw new AppError("UNAUTHORIZED", "Unauthorized.", 401);
    }
    if (authUser.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "Admin role required.", 403);
    }
    if (authUser.status !== "ACTIVE") {
      throw new AppError("ACCOUNT_BANNED", "User account is not active.", 403);
    }
    return { authUserId, authUser };
  });

export const requireParent = new Elysia()
  .use(requireAuth)
  .resolve({ as: "scoped" }, async ({ authUserId, authUser }) => {
    if (!authUser || !authUserId) {
      throw new AppError("UNAUTHORIZED", "Unauthorized.", 401);
    }
    if (authUser.role !== "PARENT") {
      throw new AppError("FORBIDDEN", "Parent role required.", 403);
    }
    if (authUser.status !== "ACTIVE") {
      throw new AppError("ACCOUNT_BANNED", "User account is not active.", 403);
    }
    return { authUserId, authUser };
  });

export const requireActiveUser = new Elysia()
  .use(requireAuth)
  .resolve({ as: "scoped" }, async ({ authUserId, authUser }) => {
    if (!authUser || !authUserId) {
      throw new AppError("UNAUTHORIZED", "Unauthorized.", 401);
    }
    if (authUser.status !== "ACTIVE") {
      throw new AppError("ACCOUNT_BANNED", "User account is not active.", 403);
    }
    return { authUserId, authUser };
  });

