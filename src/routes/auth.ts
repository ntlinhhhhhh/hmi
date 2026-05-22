import { Elysia, t } from "elysia";
import { signInParent } from "../usecases/auth/sign_in.ts";
import { signOut } from "../usecases/auth/sign_out.ts";
import { signUpParent } from "../usecases/auth/sign_up.ts";
import { withApiErrorHandler } from "./api_error_handler.ts";
import { requireAuth } from "./middleware/require_auth.ts";

const protectedAuthRouter = new Elysia()
  .use(requireAuth)
  .get("/me", async ({ authSessionId, authSessionExpiresAt, authUser, set }) => {
    set.status = 200;
    return {
      session: {
        id: authSessionId,
        expires_at: authSessionExpiresAt,
      },
      user: {
        id: authUser.id,
        email: authUser.email,
        phone_number: authUser.phoneNumber,
        full_name: authUser.fullName,
        role: authUser.role,
        status: authUser.status,
        last_login_at: authUser.lastLoginAt,
        created_at: authUser.createdAt,
      },
    };
  })
  .delete("/auth/session", async ({ authSessionToken, set }) => {
    await signOut(authSessionToken);

    set.status = 200;
    return {
      message: "Signed out successfully.",
    };
  });

const authRouter = withApiErrorHandler(new Elysia(), {
  validationErrorType: "INVALID_JSON",
})
  .post(
    "/auth/signup",
    async ({ body, set }) => {
      const user = await signUpParent({
        email: body.email,
        password: body.password,
        phoneNumber: body.phone_number,
        fullName: body.full_name,
      });

      set.status = 201;
      return {
        message: "Account created successfully.",
        user: {
          id: user.id,
          email: user.email,
          phone_number: user.phoneNumber,
          full_name: user.fullName,
          role: user.role,
          status: user.status,
          created_at: user.createdAt,
        },
      };
    },
    {
      body: t.Object({
        email: t.String(),
        password: t.String(),
        phone_number: t.Optional(t.String()),
        full_name: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/auth/signin",
    async ({ body, set }) => {
      const user = await signInParent({
        identifier: body.identifier,
        password: body.password,
      });

      set.status = 200;
      return {
        message: "Signed in successfully.",
        user: {
          id: user.id,
          email: user.email,
          phone_number: user.phoneNumber,
          full_name: user.fullName,
          role: user.role,
          status: user.status,
          last_login_at: user.lastLoginAt,
        },
        session: {
          id: user.sessionId,
          session_token: user.sessionToken,
          expires_at: user.expiresAt,
        },
      };
    },
    {
      body: t.Object({
        identifier: t.String(),
        password: t.String(),
      }),
    },
  )
  .use(protectedAuthRouter);

export default authRouter;
