import { Elysia } from "elysia";
import { getCurrentSession } from "../../usecases/auth/get_current_session.ts";

function readBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader) return "";

  const match = authorizationHeader.trim().match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return "";

  return match[1].trim();
}

export const requireAuth = new Elysia({ name: "require-auth" }).resolve(
  { as: "scoped" },
  async ({ headers }) => {
    const sessionToken = readBearerToken(headers["authorization"]);
    const session = await getCurrentSession(sessionToken);

    return {
      authSessionId: session.sessionId,
      authSessionToken: sessionToken,
      authSessionExpiresAt: session.expiresAt,
      authUserId: session.user.id,
      authUser: session.user,
    };
  },
);
