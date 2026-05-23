import { Elysia, t } from "elysia";
import { changePassword } from "../usecases/auth/change_password.ts";
import { googleSignIn } from "../usecases/auth/google_sign_in.ts";
import {
  requestPasswordReset,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from "../usecases/auth/password_reset.ts";
import { confirmPasswordResetPhone } from "../usecases/auth/password_reset_phone.ts";
import { signInParent } from "../usecases/auth/sign_in.ts";
import { signOut } from "../usecases/auth/sign_out.ts";
import { signUpParent } from "../usecases/auth/sign_up.ts";
import { updateCurrentUser } from "../usecases/auth/update_current_user.ts";
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
  .patch(
    "/me",
    async ({ authUserId, body, set }) => {
      const user = await updateCurrentUser({
        userId: authUserId,
        email: body.email,
        phoneNumber: body.phone_number,
        fullName: body.full_name,
      });

      set.status = 200;
      return {
        message: "Account profile updated successfully.",
        user: {
          id: user.id,
          email: user.email,
          phone_number: user.phoneNumber,
          full_name: user.fullName,
          role: user.role,
          status: user.status,
          last_login_at: user.lastLoginAt,
          created_at: user.createdAt,
          updated_at: user.updatedAt,
        },
      };
    },
    {
      body: t.Object({
        email: t.Optional(t.String()),
        phone_number: t.Optional(t.Union([t.String(), t.Null()])),
        full_name: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    },
  )
  .patch(
    "/me/password",
    async ({ authUserId, body, set }) => {
      await changePassword({
        userId: authUserId,
        currentPassword: body.current_password,
        newPassword: body.new_password,
      });

      set.status = 200;
      return {
        message: "Password changed successfully.",
      };
    },
    {
      body: t.Object({
        current_password: t.String(),
        new_password: t.String(),
      }),
    },
  )
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
          last_login_at: user.lastLoginAt,
          created_at: user.createdAt,
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
  .post(
    "/auth/google",
    async ({ body, set }) => {
      const user = await googleSignIn({
        idToken: body.id_token,
      });

      set.status = 200;
      return {
        message: "Signed in with Google successfully.",
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
        id_token: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/auth/password-reset/request",
    async ({ body, set }) => {
      const result = await requestPasswordReset(body.identifier);
      set.status = 200;
      return result;
    },
    {
      body: t.Object({
        identifier: t.String(),
      }),
    },
  )
  .post(
    "/auth/password-reset/verify",
    async ({ body, set }) => {
      const result = await verifyPasswordResetCode(body.identifier, body.otp);
      set.status = 200;
      return {
        message: result.message,
        reset_token: result.resetToken,
      };
    },
    {
      body: t.Object({
        identifier: t.String(),
        otp: t.String(),
      }),
    },
  )
  .post(
    "/auth/password-reset/confirm",
    async ({ body, set }) => {
      const result = await confirmPasswordReset(
        body.identifier,
        body.reset_token,
        body.new_password,
      );
      set.status = 200;
      return result;
    },
    {
      body: t.Object({
        identifier: t.String(),
        reset_token: t.String(),
        new_password: t.String(),
      }),
    },
  )
  .post(
    "/auth/password-reset/confirm-phone",
    async ({ body, set }) => {
      const result = await confirmPasswordResetPhone(body.id_token, body.new_password);
      set.status = 200;
      return result;
    },
    {
      body: t.Object({
        id_token: t.String(),
        new_password: t.String(),
      }),
    },
  )
  .use(protectedAuthRouter);

export default authRouter;
