import { db, withTx } from "../../db/client.ts";
import { findUserByIdentifier } from "../../db/queries/user_queries.ts";
import { AppError } from "../app_error.ts";
import * as admin from "firebase-admin";

export type PasswordResetPhoneErrorType =
  | "INVALID_TOKEN"
  | "MISSING_PASSWORD"
  | "WEAK_PASSWORD"
  | "USER_NOT_FOUND"
  | "INTERNAL_ERROR";

let firebaseApp: admin.app.App | null = null;
function getFirebaseApp() {
  if (!firebaseApp) {
    try {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert("./firebase_adminsdk.json"),
      });
    } catch (error) {
      console.error("[ERROR] Failed to initialize Firebase Admin:", error);
      throw new AppError<PasswordResetPhoneErrorType>(
        "INTERNAL_ERROR",
        "Firebase misconfigured.",
        500,
      );
    }
  }
  return firebaseApp;
}

export async function confirmPasswordResetPhone(idToken: string, newPassword: string) {
  if (!idToken || !newPassword) {
    throw new AppError<PasswordResetPhoneErrorType>(
      "MISSING_PASSWORD",
      "Firebase ID token and new password are required.",
      400,
    );
  }

  if (newPassword.length < 8) {
    throw new AppError<PasswordResetPhoneErrorType>(
      "WEAK_PASSWORD",
      "Password must be at least 8 characters.",
      400,
    );
  }

  let decodedToken: admin.auth.DecodedIdToken;
  try {
    const app = getFirebaseApp();
    decodedToken = await app.auth().verifyIdToken(idToken);
  } catch (error) {
    console.error("[ERROR] Firebase verifyIdToken failed:", error);
    throw new AppError<PasswordResetPhoneErrorType>(
      "INVALID_TOKEN",
      "Invalid or expired Firebase token.",
      401,
    );
  }

  const phoneNumber = decodedToken.phone_number;
  if (!phoneNumber) {
    throw new AppError<PasswordResetPhoneErrorType>(
      "INVALID_TOKEN",
      "Token does not contain a verified phone number.",
      400,
    );
  }

  try {
    const user = await findUserByIdentifier(db, phoneNumber);
    if (!user) {
      throw new AppError<PasswordResetPhoneErrorType>(
        "USER_NOT_FOUND",
        "No account found for this phone number.",
        404,
      );
    }

    const newPasswordHash = await Bun.password.hash(newPassword, { algorithm: "argon2id" });

    await withTx(async (tx) => {
      const { users, sessions } = await import("../../db/schema.ts");
      const { eq } = await import("drizzle-orm");

      await tx.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, user.id));
      await tx.delete(sessions).where(eq(sessions.userId, user.id));
    });

    return { message: "Password updated successfully." };
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("[ERROR] confirmPasswordResetPhone:", error);
    throw new AppError<PasswordResetPhoneErrorType>(
      "INTERNAL_ERROR",
      "Internal server error.",
      500,
    );
  }
}
