import { Elysia, t } from "elysia";
import { createChildProfile } from "../usecases/children/create_child_profile.ts";
import { listChildProfiles } from "../usecases/children/list_child_profiles.ts";
import { withApiErrorHandler } from "./api_error_handler.ts";
import { requireAuth } from "./middleware/require_auth.ts";

const protectedChildrenRouter = new Elysia()
  .use(requireAuth)
  .post(
    "/children",
    async ({ authUserId, body, set }) => {
      const child = await createChildProfile({
        parentId: authUserId,
        nickname: body.nickname,
        birthYear: body.birth_year,
        avatarUrl: body.avatar_url,
      });

      set.status = 201;
      return {
        message: "Child profile created successfully.",
        child: {
          id: child.id,
          parent_id: child.parentId,
          nickname: child.nickname,
          avatar_url: child.avatarUrl,
          birth_year: child.birthYear,
          total_stars: child.totalStars,
          created_at: child.createdAt,
          updated_at: child.updatedAt,
        },
      };
    },
    {
      body: t.Object({
        nickname: t.String(),
        birth_year: t.Number(),
        avatar_url: t.Optional(t.String()),
      }),
    },
  )
  .get("/children", async ({ authUserId, set }) => {
    const children = await listChildProfiles(authUserId);

    set.status = 200;
    return {
      children: children.map((child) => ({
        id: child.id,
        parent_id: child.parentId,
        nickname: child.nickname,
        avatar_url: child.avatarUrl,
        birth_year: child.birthYear,
        total_stars: child.totalStars,
        created_at: child.createdAt,
        updated_at: child.updatedAt,
        preferences: child.preferences
          ? {
              is_high_contrast: child.preferences.isHighContrast,
              preferences: child.preferences.preferencesData,
            }
          : null,
      })),
    };
  });

const childrenRouter = withApiErrorHandler(new Elysia(), {
  validationErrorType: "INVALID_JSON",
}).use(protectedChildrenRouter);

export default childrenRouter;
