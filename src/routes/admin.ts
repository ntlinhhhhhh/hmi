import { Elysia, t } from "elysia";
import { createAdminPet } from "../usecases/admin/pets/create_admin_pet.ts";
import { createMediaAsset } from "../usecases/admin/media/create_media_asset.ts";
import { deleteAdminPet } from "../usecases/admin/pets/delete_admin_pet.ts";
import { listAdminPets } from "../usecases/admin/pets/list_admin_pets.ts";
import type { PetCatalogResult } from "../usecases/admin/pets/pet_catalog.ts";
import { updateAdminPet } from "../usecases/admin/pets/update_admin_pet.ts";
import { getAdminUser } from "../usecases/admin/users/get_admin_user.ts";
import { listAdminUsers } from "../usecases/admin/users/list_admin_users.ts";
import { updateAdminUser } from "../usecases/admin/users/update_admin_user.ts";
import { deleteAdminUser } from "../usecases/admin/users/delete_admin_user.ts";
import { getSystemAnalytics } from "../usecases/admin/analytics/get_system_analytics.ts";
import { listAdminContents } from "../usecases/admin/content/list_admin_contents.ts";
import { createAdminContent } from "../usecases/admin/content/create_admin_content.ts";
import { getAdminContentDetail } from "../usecases/admin/content/get_admin_content_detail.ts";
import { updateAdminContent } from "../usecases/admin/content/update_admin_content.ts";
import { deleteAdminContent } from "../usecases/admin/content/delete_admin_content.ts";
import type {
  AdminUserDetailResult,
  AdminUserResult,
} from "../usecases/admin/users/admin_user_models.ts";
import { withApiErrorHandler } from "./api_error_handler.ts";
import { requireAdmin } from "./middleware/rbac.ts";
import { requireAuth } from "./middleware/require_auth.ts";

function parseOptionalNumber(rawValue: string | undefined): number | undefined {
  if (rawValue === undefined || rawValue.trim() === "") return undefined;
  return Number(rawValue);
}

function formatPet(pet: PetCatalogResult) {
  return {
    id: pet.id,
    name: pet.name,
    description: pet.description,
    image_url: pet.imageUrl,
    animation_url: pet.animationUrl,
    unlock_star_cost: pet.unlockStarCost,
    status: pet.status,
    created_at: pet.createdAt,
    updated_at: pet.updatedAt,
    deleted_at: pet.deletedAt,
  };
}

function formatContent(content: any) {
  return {
    id: content.id,
    title: content.title,
    type: content.type,
    status: content.status,
    created_by: content.createdBy,
    created_at: content.createdAt,
    updated_at: content.updatedAt,
    deleted_at: content.deletedAt,
    difficulty_level: content.difficultyLevel,
    unlock_star_cost: content.unlockStarCost,
    lecture: content.lecture
      ? {
          media_url: content.lecture.mediaUrl,
          description: content.lecture.description,
          difficulty_level: content.lecture.difficultyLevel,
          is_default: content.lecture.isDefault,
        }
      : null,
    quiz: content.quiz
      ? {
          media_url: content.quiz.mediaUrl,
          description: content.quiz.description,
          difficulty_level: content.quiz.difficultyLevel,
          is_default: content.quiz.isDefault,
          answer_emotions: content.quiz.answerEmotions,
          correct_emotion: content.quiz.correctEmotion,
        }
      : null,
    game: content.game
      ? {
          target_emotion: content.game.targetEmotion,
          time_limit_seconds: content.game.timeLimitSeconds,
          difficulty_level: content.game.difficultyLevel,
          is_default: content.game.isDefault,
          unlock_star_cost: content.game.unlockStarCost,
          prompt_asset_type: content.game.promptAssetType,
          prompt_asset_url: content.game.promptAssetUrl,
        }
      : null,
  };
}

function formatAdminUser(user: AdminUserResult) {
  return {
    id: user.id,
    email: user.email,
    phone_number: user.phoneNumber,
    auth_provider: user.authProvider,
    full_name: user.fullName,
    role: user.role,
    status: user.status,
    last_login_at: user.lastLoginAt,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}

function formatAdminUserDetail(detail: AdminUserDetailResult) {
  return {
    user: formatAdminUser(detail.user),
    child_count: detail.childCount,
    sessions: {
      total_sessions: detail.sessions.totalSessions,
      active_sessions: detail.sessions.activeSessions,
      last_used_at: detail.sessions.lastUsedAt,
    },
  };
}

const protectedAdminRouter = new Elysia()
  .use(requireAuth)
  .use(requireAdmin)
  .post(
    "/admin/media-assets",
    async ({ authUserId, body, set }) => {
      const file = body.file;
      if (!file) {
        set.status = 400;
        return {
          error: {
            type: "MISSING_FILE",
            message: "File is required.",
          },
        };
      }

      const mediaAsset = await createMediaAsset({
        adminId: authUserId,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        purpose: body.purpose,
        buffer: new Uint8Array(await file.arrayBuffer()),
      });

      set.status = 201;
      return {
        message: "Media asset created and uploaded successfully.",
        media_asset: {
          id: mediaAsset.id,
          file_name: mediaAsset.fileName,
          storage_key: mediaAsset.storageKey,
          mime_type: mediaAsset.mimeType,
          size_bytes: mediaAsset.sizeBytes,
          purpose: mediaAsset.purpose,
          created_by: mediaAsset.createdBy,
          url: mediaAsset.url,
          created_at: mediaAsset.createdAt,
        },
      };
    },
    {
      parse: "formdata",
      body: t.Object({
        file: t.File(),
        purpose: t.String(),
      }),
    },
  )
  .get(
    "/admin/pets",
    async ({ authUserId, query, set }) => {
      const result = await listAdminPets({
        adminId: authUserId,
        status: query.status,
        search: query.search,
        cursor: query.cursor,
        limit: parseOptionalNumber(query.limit),
      });

      set.status = 200;
      return {
        pets: result.pets.map(formatPet),
        next_cursor: result.nextCursor,
      };
    },
    {
      query: t.Object({
        status: t.Optional(t.String()),
        search: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/admin/pets",
    async ({ authUserId, body, set }) => {
      const pet = await createAdminPet({
        adminId: authUserId,
        name: body.name,
        description: body.description,
        imageUrl: body.image_url,
        animationUrl: body.animation_url,
        unlockStarCost: body.unlock_star_cost,
        status: body.status,
      });

      set.status = 201;
      return {
        message: "Pet catalog item created successfully.",
        pet: formatPet(pet),
      };
    },
    {
      body: t.Object({
        name: t.String(),
        description: t.Optional(t.Union([t.String(), t.Null()])),
        image_url: t.String(),
        animation_url: t.Optional(t.Union([t.String(), t.Null()])),
        unlock_star_cost: t.Number(),
        status: t.Optional(t.String()),
      }),
    },
  )
  .patch(
    "/admin/pets/:petId",
    async ({ authUserId, params, body, set }) => {
      const pet = await updateAdminPet({
        adminId: authUserId,
        petId: params.petId,
        name: body.name,
        description: body.description,
        imageUrl: body.image_url,
        animationUrl: body.animation_url,
        unlockStarCost: body.unlock_star_cost,
        status: body.status,
      });

      set.status = 200;
      return {
        message: "Pet catalog item updated successfully.",
        pet: formatPet(pet),
      };
    },
    {
      params: t.Object({
        petId: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.Union([t.String(), t.Null()])),
        image_url: t.Optional(t.String()),
        animation_url: t.Optional(t.Union([t.String(), t.Null()])),
        unlock_star_cost: t.Optional(t.Number()),
        status: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    "/admin/pets/:petId",
    async ({ authUserId, params, body, set }) => {
      await deleteAdminPet({
        adminId: authUserId,
        petId: params.petId,
        confirmation: body.confirmation,
      });

      set.status = 200;
      return {
        message: "Pet catalog item deleted successfully.",
      };
    },
    {
      params: t.Object({
        petId: t.String(),
      }),
      body: t.Object({
        confirmation: t.String(),
      }),
    },
  )
  .get(
    "/admin/users",
    async ({ authUserId, query, set }) => {
      const result = await listAdminUsers({
        adminId: authUserId,
        role: query.role,
        status: query.status,
        search: query.search,
        cursor: query.cursor,
        limit: parseOptionalNumber(query.limit),
      });

      set.status = 200;
      return {
        users: result.users.map(formatAdminUser),
        next_cursor: result.nextCursor,
      };
    },
    {
      query: t.Object({
        role: t.Optional(t.String()),
        status: t.Optional(t.String()),
        search: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/admin/users/:userId",
    async ({ authUserId, params, set }) => {
      const detail = await getAdminUser({
        adminId: authUserId,
        userId: params.userId,
      });

      set.status = 200;
      return formatAdminUserDetail(detail);
    },
    {
      params: t.Object({
        userId: t.String(),
      }),
    },
  )
  .patch(
    "/admin/users/:userId",
    async ({ authUserId, params, body, set }) => {
      const user = await updateAdminUser({
        adminId: authUserId,
        userId: params.userId,
        status: body.status,
        role: body.role,
      });

      set.status = 200;
      return {
        message: "User status/role updated successfully.",
        user: formatAdminUser(user),
      };
    },
    {
      params: t.Object({
        userId: t.String(),
      }),
      body: t.Object({
        status: t.Optional(t.String()),
        role: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    "/admin/users/:userId",
    async ({ authUserId, params, body, set }) => {
      await deleteAdminUser({
        adminId: authUserId,
        userId: params.userId,
        confirmation: body.confirmation,
        reason: body.reason,
      });

      set.status = 200;
      return {
        message: "User account deleted successfully.",
      };
    },
    {
      params: t.Object({
        userId: t.String(),
      }),
      body: t.Object({
        confirmation: t.String(),
        reason: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/admin/contents",
    async ({ authUserId, query, set }) => {
      const result = await listAdminContents({
        adminId: authUserId,
        type: query.type,
        status: query.status,
        search: query.search,
        cursor: query.cursor,
        limit: parseOptionalNumber(query.limit),
      });

      set.status = 200;
      return {
        contents: result.contents.map(formatContent),
        next_cursor: result.nextCursor,
      };
    },
    {
      query: t.Object({
        type: t.Optional(t.String()),
        status: t.Optional(t.String()),
        search: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/admin/contents",
    async ({ authUserId, body, set }) => {
      const content = await createAdminContent({
        adminId: authUserId,
        title: body.title,
        type: body.type,
        status: body.status,
        lecture: body.lecture,
        quiz: body.quiz,
        game: body.game,
      });

      set.status = 201;
      return {
        message: "Content created successfully.",
        content: formatContent(content),
      };
    },
    {
      body: t.Object({
        title: t.String(),
        type: t.String(),
        status: t.Optional(t.String()),
        lecture: t.Optional(
          t.Object({
            mediaUrl: t.Optional(t.String()),
            description: t.Optional(t.Union([t.String(), t.Null()])),
            difficultyLevel: t.Optional(t.Number()),
            isDefault: t.Optional(t.Boolean()),
          })
        ),
        quiz: t.Optional(
          t.Object({
            mediaUrl: t.Optional(t.String()),
            description: t.Optional(t.Union([t.String(), t.Null()])),
            difficultyLevel: t.Optional(t.Number()),
            isDefault: t.Optional(t.Boolean()),
            answerEmotions: t.Array(t.String()),
            correctEmotion: t.String(),
          })
        ),
        game: t.Optional(
          t.Object({
            targetEmotion: t.String(),
            timeLimitSeconds: t.Number(),
            difficultyLevel: t.Optional(t.Number()),
            isDefault: t.Optional(t.Boolean()),
            unlockStarCost: t.Optional(t.Number()),
            promptAssetType: t.Optional(t.Union([t.String(), t.Null()])),
            promptAssetUrl: t.Optional(t.Union([t.String(), t.Null()])),
          })
        ),
      }),
    },
  )
  .get(
    "/admin/contents/:contentId",
    async ({ authUserId, params, set }) => {
      const content = await getAdminContentDetail({
        adminId: authUserId,
        contentId: params.contentId,
      });

      set.status = 200;
      return {
        content: formatContent(content),
      };
    },
    {
      params: t.Object({
        contentId: t.String(),
      }),
    },
  )
  .patch(
    "/admin/contents/:contentId",
    async ({ authUserId, params, body, set }) => {
      const content = await updateAdminContent({
        adminId: authUserId,
        contentId: params.contentId,
        title: body.title,
        status: body.status,
        lecture: body.lecture,
        quiz: body.quiz,
        game: body.game,
      });

      set.status = 200;
      return {
        message: "Content updated successfully.",
        content: formatContent(content),
      };
    },
    {
      params: t.Object({
        contentId: t.String(),
      }),
      body: t.Object({
        title: t.Optional(t.String()),
        status: t.Optional(t.String()),
        lecture: t.Optional(
          t.Object({
            mediaUrl: t.Optional(t.String()),
            description: t.Optional(t.Union([t.String(), t.Null()])),
            difficultyLevel: t.Optional(t.Number()),
            isDefault: t.Optional(t.Boolean()),
          })
        ),
        quiz: t.Optional(
          t.Object({
            mediaUrl: t.Optional(t.String()),
            description: t.Optional(t.Union([t.String(), t.Null()])),
            difficultyLevel: t.Optional(t.Number()),
            isDefault: t.Optional(t.Boolean()),
            answerEmotions: t.Optional(t.Array(t.String())),
            correctEmotion: t.Optional(t.String()),
          })
        ),
        game: t.Optional(
          t.Object({
            targetEmotion: t.Optional(t.String()),
            timeLimitSeconds: t.Optional(t.Number()),
            difficultyLevel: t.Optional(t.Number()),
            isDefault: t.Optional(t.Boolean()),
            unlockStarCost: t.Optional(t.Number()),
            promptAssetType: t.Optional(t.Union([t.String(), t.Null()])),
            promptAssetUrl: t.Optional(t.Union([t.String(), t.Null()])),
          })
        ),
      }),
    },
  )
  .delete(
    "/admin/contents/:contentId",
    async ({ authUserId, params, body, set }) => {
      await deleteAdminContent({
        adminId: authUserId,
        contentId: params.contentId,
        confirmation: body.confirmation,
      });

      set.status = 200;
      return {
        message: "Content deleted successfully.",
      };
    },
    {
      params: t.Object({
        contentId: t.String(),
      }),
      body: t.Object({
        confirmation: t.String(),
      }),
    },
  )
  .get(
    "/admin/analytics",
    async ({ authUserId, query, set }) => {
      const result = await getSystemAnalytics({
        adminId: authUserId,
        from: query.from,
        to: query.to,
      });

      set.status = 200;
      return result;
    },
    {
      query: t.Object({
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
      }),
    },
  );

const adminRouter = withApiErrorHandler(new Elysia(), {
  validationErrorType: "INVALID_JSON",
}).use(protectedAdminRouter);

export default adminRouter;
