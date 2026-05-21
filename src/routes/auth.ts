import { Elysia, t } from "elysia";
import { signUpParent } from "../usecases/auth/sign_up.ts";
import { withApiErrorHandler } from "./api_error_handler.ts";

const authRouter = withApiErrorHandler(new Elysia(), {
  validationErrorType: "INVALID_JSON",
}).post(
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
);

export default authRouter;
