import { Elysia, t } from "elysia";
import { registerDeviceToken } from "../usecases/notifications/register_device_token.ts";
import { deregisterDeviceToken } from "../usecases/notifications/deregister_device_token.ts";
import { withApiErrorHandler } from "./api_error_handler.ts";
import { requireAuth } from "./middleware/require_auth.ts";

const protectedDevicesRouter = new Elysia()
  .use(requireAuth)
  .post(
    "/devices",
    async ({ authUserId, body, set }) => {
      const device = await registerDeviceToken({
        userId: authUserId,
        platform: body.platform,
        pushToken: body.push_token,
        appInstanceId: body.app_instance_id,
      });

      set.status = 201;
      return {
        id: device.id,
        user_id: device.userId,
        platform: device.platform,
        push_token: device.pushToken,
        app_instance_id: device.appInstanceId,
        is_active: device.isActive,
        created_at: device.createdAt,
        updated_at: device.updatedAt,
      };
    },
    {
      body: t.Object({
        platform: t.String(),
        push_token: t.String(),
        app_instance_id: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    "/devices/:deviceId",
    async ({ authUserId, params, set }) => {
      await deregisterDeviceToken({
        userId: authUserId,
        deviceId: params.deviceId,
      });

      set.status = 200;
      return {
        message: "Device unregistered successfully.",
      };
    },
    {
      params: t.Object({
        deviceId: t.String(),
      }),
    },
  );

const devicesRouter = withApiErrorHandler(new Elysia(), {
  validationErrorType: "INVALID_JSON",
}).use(protectedDevicesRouter);

export default devicesRouter;
