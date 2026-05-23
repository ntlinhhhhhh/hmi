import { Elysia, t } from "elysia";
import { createAdminPet } from "../usecases/admin/pets/create_admin_pet.ts";
import { deleteAdminPet } from "../usecases/admin/pets/delete_admin_pet.ts";
import { listAdminPets } from "../usecases/admin/pets/list_admin_pets.ts";
import type { PetCatalogResult } from "../usecases/admin/pets/pet_catalog.ts";
import { updateAdminPet } from "../usecases/admin/pets/update_admin_pet.ts";
import { withApiErrorHandler } from "./api_error_handler.ts";
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

const protectedAdminRouter = new Elysia()
  .use(requireAuth)
  .get(
    "/admin/pets",
    async ({ authUserId, query, set }) => {
      const pets = await listAdminPets({
        adminId: authUserId,
        status: query.status,
        search: query.search,
        limit: parseOptionalNumber(query.limit),
      });

      set.status = 200;
      return {
        pets: pets.map(formatPet),
      };
    },
    {
      query: t.Object({
        status: t.Optional(t.String()),
        search: t.Optional(t.String()),
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
  );

const adminRouter = withApiErrorHandler(new Elysia(), {
  validationErrorType: "INVALID_JSON",
}).use(protectedAdminRouter);

export default adminRouter;
