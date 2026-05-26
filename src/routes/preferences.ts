import { Elysia, t } from "elysia";
import { getChildPreferences } from "../usecases/preferences/get_child_preferences.ts";
import { updateChildPreferences } from "../usecases/preferences/update_child_preferences.ts";
import { withApiErrorHandler } from "./api_error_handler.ts";
import { requireAuth } from "./middleware/require_auth.ts";

const protectedPreferencesRouter = new Elysia()
  .use(requireAuth)
  .get(
    "/children/:childId/preferences",
    async ({ authUserId, params, set }) => {
      const preferences = await getChildPreferences({
        parentId: authUserId,
        childId: params.childId,
      });

      set.status = 200;
      return {
        preferences: {
          child_id: preferences.childId,
          is_high_contrast: preferences.isHighContrast,
          preferences: preferences.preferences,
          created_at: preferences.createdAt,
          updated_at: preferences.updatedAt,
        },
      };
    },
    {
      params: t.Object({
        childId: t.String(),
      }),
    },
  )
  .patch(
    "/children/:childId/preferences",
    async ({ authUserId, params, body, set }) => {
      const preferences = await updateChildPreferences({
        parentId: authUserId,
        childId: params.childId,
        isHighContrast: body.is_high_contrast,
        preferences: body.preferences,
      });

      set.status = 200;
      return {
        message: "Child preferences updated successfully.",
        preferences: {
          child_id: preferences.childId,
          is_high_contrast: preferences.isHighContrast,
          preferences: preferences.preferences,
          created_at: preferences.createdAt,
          updated_at: preferences.updatedAt,
        },
      };
    },
    {
      params: t.Object({
        childId: t.String(),
      }),
      body: t.Object({
        is_high_contrast: t.Optional(t.Boolean()),
        preferences: t.Optional(t.Unknown()),
      }),
    },
  );

const preferencesRouter = withApiErrorHandler(new Elysia(), {
  validationErrorType: "INVALID_JSON",
}).use(protectedPreferencesRouter);

export default preferencesRouter;
