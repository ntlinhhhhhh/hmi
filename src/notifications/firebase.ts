import admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

let initialized = false;

export type PushNotificationResult = {
  attemptedTokens: number;
  successCount: number;
  failureCount: number;
  mocked: boolean;
};

export function initializeFirebase(): boolean {
  if (initialized) return true;

  const configPath = path.join(process.cwd(), "firebase_adminsdk.json");
  if (!fs.existsSync(configPath)) {
    console.warn(
      `[WARN] Firebase credentials file not found at ${configPath}. Push notifications will be mocked.`,
    );
    return false;
  }

  try {
    const serviceAccount = JSON.parse(fs.readFileSync(configPath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    console.log("[INFO] Firebase Admin SDK initialized successfully.");
    return true;
  } catch (error) {
    console.error("[ERROR] Failed to initialize Firebase Admin SDK:", error);
    return false;
  }
}

export async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<PushNotificationResult> {
  const activeTokens = tokens.filter((t) => t && t.trim() !== "");
  if (activeTokens.length === 0) {
    return {
      attemptedTokens: 0,
      successCount: 0,
      failureCount: 0,
      mocked: false,
    };
  }

  const isInitialized = initializeFirebase();

  if (!isInitialized) {
    console.log(
      `[MOCK FCM PUSH] Target Tokens: [${activeTokens.join(
        ", ",
      )}]. Title: "${title}", Body: "${body}". Data:`,
      data,
    );
    return {
      attemptedTokens: activeTokens.length,
      successCount: activeTokens.length,
      failureCount: 0,
      mocked: true,
    };
  }

  try {
    const message: admin.messaging.MulticastMessage = {
      tokens: activeTokens,
      notification: {
        title,
        body,
      },
      data,
    };
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(
      `[INFO] FCM push notification dispatch success: ${response.successCount} sent, ${response.failureCount} failed.`,
    );
    return {
      attemptedTokens: activeTokens.length,
      successCount: response.successCount,
      failureCount: response.failureCount,
      mocked: false,
    };
  } catch (error) {
    console.error("[ERROR] Failed to send push notifications via FCM:", error);
    return {
      attemptedTokens: activeTokens.length,
      successCount: 0,
      failureCount: activeTokens.length,
      mocked: false,
    };
  }
}
