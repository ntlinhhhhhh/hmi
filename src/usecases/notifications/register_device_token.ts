import { db } from "../../db/client.ts";
import { deviceTokens } from "../../db/schema.ts";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { AppError } from "../app_error.ts";
import { isValidUuid } from "../../utils/validation.ts";

export type RegisterDeviceTokenInput = {
  userId: string;
  platform: string;
  pushToken: string;
  appInstanceId?: string;
};

export type DeviceTokenResult = {
  id: string;
  userId: string;
  platform: string;
  pushToken: string;
  appInstanceId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function registerDeviceToken(input: RegisterDeviceTokenInput): Promise<DeviceTokenResult> {
  const userId = input.userId.trim();
  if (!userId || !isValidUuid(userId)) {
    throw new AppError("INVALID_USER_ID", "Invalid user ID format.", 400);
  }

  const platform = input.platform.trim().toUpperCase();
  if (!["WEB", "IOS", "ANDROID"].includes(platform)) {
    throw new AppError("INVALID_PLATFORM", "Platform must be WEB, IOS, or ANDROID.", 400);
  }

  const pushToken = input.pushToken.trim();
  if (!pushToken) {
    throw new AppError("INVALID_PUSH_TOKEN", "Push token cannot be empty.", 400);
  }

  const appInstanceId = input.appInstanceId?.trim() || null;

  try {
    // Check if device token already exists
    const existing = await db.query.deviceTokens.findFirst({
      where: eq(deviceTokens.pushToken, pushToken),
    });

    if (existing) {
      // Update existing record
      const [updated] = await db
        .update(deviceTokens)
        .set({
          userId: userId, // associate to the new user if it changed
          platform,
          appInstanceId,
          isActive: true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(deviceTokens.id, existing.id))
        .returning();

      if (!updated) throw new Error("Failed to update device token.");
      return updated;
    } else {
      // Insert new record
      const [inserted] = await db
        .insert(deviceTokens)
        .values({
          id: randomUUID(),
          userId,
          platform,
          pushToken,
          appInstanceId,
          isActive: true,
        })
        .returning();

      if (!inserted) throw new Error("Failed to insert device token.");
      return inserted;
    }
  } catch (error: unknown) {
    if (error instanceof AppError) throw error;
    console.error("[ERROR] Unexpected error in registerDeviceToken:", error);
    throw new AppError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
