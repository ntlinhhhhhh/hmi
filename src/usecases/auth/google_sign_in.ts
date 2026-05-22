import { OAuth2Client } from "google-auth-library";
import { db, withTx } from "../../db/client.ts";
import { createSession } from "../../db/queries/session_queries.ts";
import {
  createUser,
  findUserByIdentifier,
  markUserLoggedIn,
  updateUserProfile,
} from "../../db/queries/user_queries.ts";
import { AppError } from "../app_error.ts";
import { generateSessionToken, hashSessionToken, readSessionTtlMs } from "./session_token.ts";
import type { SignInParentResult } from "./sign_in.ts";

export type GoogleSignInErrorType = "MISSING_TOKEN" | "INVALID_TOKEN" | "INTERNAL_ERROR";

export type GoogleSignInInput = {
  idToken?: string;
};

export async function googleSignIn(input: GoogleSignInInput): Promise<SignInParentResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new AppError<GoogleSignInErrorType>(
      "INTERNAL_ERROR",
      "Google Client ID is not configured.",
      500,
    );
  }

  const client = new OAuth2Client(clientId);
  let idToken = input.idToken;

  if (!idToken) {
    throw new AppError<GoogleSignInErrorType>("MISSING_TOKEN", "Missing Google token.", 400);
  }

  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });
    payload = ticket.getPayload();
  } catch (e) {
    throw new AppError<GoogleSignInErrorType>("INVALID_TOKEN", "Invalid Google ID token.", 401);
  }

  if (!payload || !payload.email || !payload.sub) {
    throw new AppError<GoogleSignInErrorType>(
      "INVALID_TOKEN",
      "Google token missing required profile information.",
      401,
    );
  }

  const email = payload.email.toLowerCase();
  const providerId = payload.sub;
  const fullName = payload.name;

  try {
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + readSessionTtlMs()).toISOString();

    const { session, updatedUser } = await withTx(async (tx) => {
      let user = await findUserByIdentifier(tx, email);

      if (user) {
        // Link account if not already linked
        if (user.authProvider !== "GOOGLE" || user.providerId !== providerId) {
          user = await updateUserProfile(tx, user.id, {
            authProvider: "GOOGLE",
            providerId,
          });
        }
        user = await markUserLoggedIn(tx, user.id);
      } else {
        user = await createUser(tx, {
          email,
          fullName,
          authProvider: "GOOGLE",
          providerId,
          role: "PARENT",
          status: "ACTIVE",
        });
        user = await markUserLoggedIn(tx, user.id);
      }

      const session = await createSession(tx, {
        userId: user.id,
        sessionTokenHash: hashSessionToken(sessionToken),
        expiresAt,
      });

      return { session, updatedUser: user };
    });

    return {
      sessionId: session.id,
      sessionToken,
      expiresAt: session.expiresAt,
      id: updatedUser.id,
      email: updatedUser.email,
      phoneNumber: updatedUser.phoneNumber ?? null,
      fullName: updatedUser.fullName ?? null,
      role: updatedUser.role,
      status: updatedUser.status,
      lastLoginAt: updatedUser.lastLoginAt ?? null,
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("[ERROR] Unexpected error in use case: Google sign in", error);
    throw new AppError<GoogleSignInErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
