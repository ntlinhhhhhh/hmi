import { Elysia, t } from "elysia";
import { buyPet } from "../usecases/pets/buy_pet.ts";
import { listActivePets } from "../usecases/pets/list_active_pets.ts";
import { listChildPets } from "../usecases/pets/list_child_pets.ts";
import { renameChildPet } from "../usecases/pets/rename_child_pet.ts";
import { withApiErrorHandler } from "./api_error_handler.ts";
import { requireAuth } from "./middleware/require_auth.ts";

function parseOptionalNumber(rawValue: string | undefined): number | undefined {
  if (rawValue === undefined || rawValue.trim() === "") return undefined;
  return Number(rawValue);
}

const protectedPetsRouter = new Elysia()
  .use(requireAuth)
  .get(
    "/pets",
    async ({ query, set }) => {
      const result = await listActivePets({
        cursor: query.cursor,
        limit: parseOptionalNumber(query.limit),
      });

      set.status = 200;
      return {
        pets: result.pets.map((pet) => ({
          id: pet.id,
          name: pet.name,
          description: pet.description,
          image_url: pet.imageUrl,
          animation_url: pet.animationUrl,
          unlock_star_cost: pet.unlockStarCost,
          status: pet.status,
          created_at: pet.createdAt,
          updated_at: pet.updatedAt,
        })),
        next_cursor: result.nextCursor,
      };
    },
    {
      query: t.Object({
        cursor: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )
  .get("/children/:childId/pets", async ({ authUserId, params, set }) => {
    const childPets = await listChildPets(authUserId, params.childId);

    set.status = 200;
    return {
      child_pets: childPets.map((childPet) => ({
        id: childPet.id,
        child_id: childPet.childId,
        pet_id: childPet.petId,
        custom_name: childPet.customName,
        unlocked_at: childPet.unlockedAt,
        pet: {
          id: childPet.pet.id,
          name: childPet.pet.name,
          description: childPet.pet.description,
          image_url: childPet.pet.imageUrl,
          animation_url: childPet.pet.animationUrl,
          unlock_star_cost: childPet.pet.unlockStarCost,
          status: childPet.pet.status,
          deleted_at: childPet.pet.deletedAt,
        },
      })),
    };
  })
  .post(
    "/children/:childId/pets",
    async ({ authUserId, params, body, set }) => {
      const purchase = await buyPet({
        parentId: authUserId,
        childId: params.childId,
        petId: body.pet_id,
        customName: body.custom_name,
      });

      set.status = 201;
      return {
        message: "Pet purchased successfully.",
        child_total_stars: purchase.childTotalStars,
        child_pet: {
          id: purchase.childPet.id,
          child_id: purchase.childPet.childId,
          pet_id: purchase.childPet.petId,
          custom_name: purchase.childPet.customName,
          unlocked_at: purchase.childPet.unlockedAt,
        },
      };
    },
    {
      body: t.Object({
        pet_id: t.String(),
        custom_name: t.Optional(t.String()),
      }),
    },
  )
  .patch(
    "/children/:childId/pets/:childPetId",
    async ({ authUserId, params, body, set }) => {
      const childPet = await renameChildPet({
        parentId: authUserId,
        childId: params.childId,
        childPetId: params.childPetId,
        customName: body.custom_name,
      });

      set.status = 200;
      return {
        message: "Pet renamed successfully.",
        child_pet: {
          id: childPet.id,
          child_id: childPet.childId,
          pet_id: childPet.petId,
          custom_name: childPet.customName,
          unlocked_at: childPet.unlockedAt,
          pet: {
            id: childPet.pet.id,
            name: childPet.pet.name,
            image_url: childPet.pet.imageUrl,
            animation_url: childPet.pet.animationUrl,
          },
        },
      };
    },
    {
      body: t.Object({
        custom_name: t.Union([t.String(), t.Null()]),
      }),
    },
  );

const petsRouter = withApiErrorHandler(new Elysia(), {
  validationErrorType: "INVALID_JSON",
}).use(protectedPetsRouter);

export default petsRouter;
