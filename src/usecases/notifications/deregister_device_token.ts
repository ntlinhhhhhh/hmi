import { db } from "../../db/client.ts";
import { deviceTokens } from "../../db/schema.ts";
import { eq, and } from "drizzle-orm";
import { AppError } from "../app_error.ts";
import { isValidUuid } from "../../utils/validation.ts";

export type DeregisterDeviceTokenInput = {
  userId: string;
  deviceId: string;
};

export async function deregisterDeviceToken(input: DeregisterDeviceTokenInput): Promise<void> {
  const userId = input.userId.trim();
  if (!userId || !isValidUuid(userId)) {
    throw new AppError("INVALID_USER_ID", "Invalid user ID format.", 400);
  }

  const deviceId = input.deviceId.trim();
  if (!deviceId || !isValidUuid(deviceId)) {
    throw new AppError("INVALID_DEVICE_ID", "Invalid device ID format.", 400);
  }

  try {
    const device = await db.query.deviceTokens.findFirst({
      where: eq(deviceTokens.id, deviceId),
    });

    if (!device) {
      throw new AppError("DEVICE_NOT_FOUND", "Device token not found.", 404);
    }

    if (device.userId !== userId) {
      throw new AppError("NOT_OWNER", "You do not own this device token.", 403);
    }

    await db.delete(deviceTokens).where(eq(deviceTokens.id, deviceId));
  } catch (error: unknown) {
    if (error instanceof AppError) throw error;
    console.error("[ERROR] Unexpected error in deregisterDeviceToken:", error);
    throw new AppError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
