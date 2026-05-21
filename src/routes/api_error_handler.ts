import { Elysia } from "elysia";
import { AppError } from "../usecases/app_error.ts";

type ApiErrorHandlerOptions = {
  validationErrorType?: string;
};

type ValidationErrorShape = {
  summary?: unknown;
  all?: unknown;
};

function getValidationMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const validationError = error as ValidationErrorShape;

    if (
      typeof validationError.summary === "string" &&
      validationError.summary.trim()
    ) {
      return validationError.summary;
    }

    if (Array.isArray(validationError.all) && validationError.all.length > 0) {
      const firstError = validationError.all[0] as ValidationErrorShape & {
        message?: unknown;
      };
      if (typeof firstError.summary === "string" && firstError.summary.trim()) {
        return firstError.summary;
      }
      if (typeof firstError.message === "string" && firstError.message.trim()) {
        return firstError.message;
      }
    }
  }

  return "Invalid request input.";
}

export const withApiErrorHandler = (
  app: Elysia,
  options: ApiErrorHandlerOptions = {},
) =>
  app.error({ AppError }).onError(({ code, error, set }) => {
    const validationErrorType = options.validationErrorType ?? "INVALID_INPUT";

    if (code === "VALIDATION") {
      set.status = 400;
      return {
        error: {
          type: validationErrorType,
          message: getValidationMessage(error),
        },
      };
    }

    if (error instanceof AppError) {
      set.status = error.statusCode;
      return {
        error: {
          type: error.type,
          message: error.message,
        },
      };
    }

    set.status = 500;
    return {
      error: {
        type: "INTERNAL_ERROR",
        message: "Internal server error.",
      },
    };
  });
