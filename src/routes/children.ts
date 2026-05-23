import { Elysia, t } from "elysia";
import { createChildProfile } from "../usecases/children/create_child_profile.ts";
import { deleteChildProfile } from "../usecases/children/delete_child_profile.ts";
import { getChildProfile } from "../usecases/children/get_child_profile.ts";
import { listChildProfiles } from "../usecases/children/list_child_profiles.ts";
import { updateChildProfile } from "../usecases/children/update_child_profile.ts";
import { toPreferenceSettingsResponse } from "../usecases/preferences/preference_settings.ts";
import { withApiErrorHandler } from "./api_error_handler.ts";
import { requireAuth } from "./middleware/require_auth.ts";

const protectedChildrenRouter = new Elysia()
  .use(requireAuth)
  .post(
    "/children",
    async ({ authUserId, body, set }) => {
      const avatar = body.avatar
        ? {
            buffer: new Uint8Array(await body.avatar.arrayBuffer()),
            contentType: body.avatar.type,
            size: body.avatar.size,
          }
        : undefined;

      const child = await createChildProfile({
        parentId: authUserId,
        nickname: body.nickname,
        birthYear: Number(body.birth_year),
        avatar,
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
      parse: "formdata",
      body: t.Object({
        nickname: t.String(),
        birth_year: t.Numeric(),
        avatar: t.Optional(t.File()),
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
              preferences: toPreferenceSettingsResponse(child.preferences.preferencesData),
            }
          : null,
      })),
    };
  })
  .get("/children/:childId", async ({ authUserId, params, set }) => {
    const child = await getChildProfile({
      parentId: authUserId,
      childId: params.childId,
    });

    set.status = 200;
    return {
      child: {
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
              preferences: toPreferenceSettingsResponse(child.preferences.preferencesData),
            }
          : null,
      },
    };
  })
  .patch(
    "/children/:childId",
    async ({ authUserId, params, body, set }) => {
      const avatar = body.avatar
        ? {
            buffer: new Uint8Array(await body.avatar.arrayBuffer()),
            contentType: body.avatar.type,
            size: body.avatar.size,
          }
        : undefined;

      const child = await updateChildProfile({
        parentId: authUserId,
        childId: params.childId,
        nickname: body.nickname,
        avatar,
      });

      set.status = 200;
      return {
        message: "Child profile updated successfully.",
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
      parse: "formdata",
      body: t.Object({
        nickname: t.Optional(t.String()),
        avatar: t.Optional(t.File()),
      }),
    },
  )
  .delete(
    "/children/:childId",
    async ({ authUserId, params, body, set }) => {
      await deleteChildProfile({
        parentId: authUserId,
        childId: params.childId,
        confirmation: body.confirmation,
      });

      set.status = 200;
      return {
        message: "Child profile deleted successfully.",
      };
    },
    {
      body: t.Object({
        confirmation: t.String(),
      }),
    },
  );

const childrenRouter = withApiErrorHandler(new Elysia(), {
  validationErrorType: "INVALID_FORM_DATA",
}).use(protectedChildrenRouter);

export default childrenRouter;
