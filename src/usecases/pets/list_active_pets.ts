import { db } from "../../db/client.ts";
import { getActiveStorePets } from "../../db/queries/store_queries.ts";
import { AppError } from "../app_error.ts";

export type ListActivePetsErrorType = "INTERNAL_ERROR";

export type StorePetListItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  animationUrl: string | null;
  unlockStarCost: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export async function listActivePets(): Promise<StorePetListItem[]> {
  try {
    const pets = await getActiveStorePets(db);

    return pets.map((pet) => ({
      id: pet.id,
      name: pet.name,
      description: pet.description ?? null,
      imageUrl: pet.imageUrl,
      animationUrl: pet.animationUrl ?? null,
      unlockStarCost: pet.unlockStarCost,
      status: pet.status,
      createdAt: pet.createdAt,
      updatedAt: pet.updatedAt,
    }));
  } catch (error: unknown) {
    console.error("[ERROR] Unexpected error in use case: List active pets", error);
    throw new AppError<ListActivePetsErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
