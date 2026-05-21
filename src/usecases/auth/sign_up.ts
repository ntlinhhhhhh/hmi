import { db } from "../../db/client.ts";
import {
  createUser,
  findUserByIdentifier,
} from "../../db/queries/user_queries.ts";
import { isValidEmail } from "../../utils/validation.ts";
import { AppError } from "../app_error.ts";
import {
  getPgConstraintName,
  isPgErrorCode,
  PgErrorCode,
} from "../postgres_error.ts";

export type SignUpErrorType =
  | "MISSING_EMAIL"
  | "INVALID_EMAIL"
  | "MISSING_PASSWORD"
  | "WEAK_PASSWORD"
  | "INVALID_PHONE_NUMBER"
  | "INVALID_FULL_NAME"
  | "EMAIL_TAKEN"
  | "PHONE_NUMBER_TAKEN"
  | "IDENTIFIER_ALREADY_IN_USE"
  | "INTERNAL_ERROR";

export type SignUpParentInput = {
  email: string;
  password: string;
  phoneNumber?: string;
  fullName?: string;
};

export type SignUpParentResult = {
  id: string;
  email: string;
  phoneNumber: string | null;
  fullName: string | null;
  role: string;
  status: string;
  createdAt: string;
};

function normalizeEmail(email: string): string {
  const value = email.trim().toLowerCase();

  if (!value) {
    throw new AppError<SignUpErrorType>(
      "MISSING_EMAIL",
      "Email is required.",
      400,
    );
  }

  if (!isValidEmail(value)) {
    throw new AppError<SignUpErrorType>(
      "INVALID_EMAIL",
      "Invalid email format.",
      400,
    );
  }

  return value;
}

function validatePassword(password: string): string {
  if (!password) {
    throw new AppError<SignUpErrorType>(
      "MISSING_PASSWORD",
      "Password is required.",
      400,
    );
  }

  if (password.length < 8) {
    throw new AppError<SignUpErrorType>(
      "WEAK_PASSWORD",
      "Password must be at least 8 characters.",
      400,
    );
  }

  return password;
}

function normalizePhoneNumber(
  phoneNumber: string | undefined,
): string | undefined {
  if (phoneNumber === undefined) return undefined;

  const value = phoneNumber.trim().replace(/[\s().-]/g, "");
  if (!value) return undefined;

  if (!/^\+?[0-9]{8,15}$/.test(value)) {
    throw new AppError<SignUpErrorType>(
      "INVALID_PHONE_NUMBER",
      "Phone number must contain 8 to 15 digits and may start with '+'.",
      400,
    );
  }

  return value;
}

function normalizeFullName(fullName: string | undefined): string | undefined {
  if (fullName === undefined) return undefined;

  const value = fullName.trim().replace(/\s+/g, " ");
  if (!value) return undefined;

  if (value.length > 120) {
    throw new AppError<SignUpErrorType>(
      "INVALID_FULL_NAME",
      "Full name must be 120 characters or fewer.",
      400,
    );
  }

  return value;
}

function mapUniqueViolation(error: unknown): AppError<SignUpErrorType> {
  const constraint = getPgConstraintName(error);

  if (constraint === "users_email_key") {
    return new AppError<SignUpErrorType>(
      "EMAIL_TAKEN",
      "Email is already in use.",
      409,
    );
  }

  if (constraint === "users_phone_number_key") {
    return new AppError<SignUpErrorType>(
      "PHONE_NUMBER_TAKEN",
      "Phone number is already in use.",
      409,
    );
  }

  return new AppError<SignUpErrorType>(
    "IDENTIFIER_ALREADY_IN_USE",
    "Email or phone number is already in use.",
    409,
  );
}

export async function signUpParent(
  input: SignUpParentInput,
): Promise<SignUpParentResult> {
  const email = normalizeEmail(input.email);
  const password = validatePassword(input.password);
  const phoneNumber = normalizePhoneNumber(input.phoneNumber);
  const fullName = normalizeFullName(input.fullName);

  try {
    const existingEmail = await findUserByIdentifier(db, email);
    if (existingEmail) {
      throw new AppError<SignUpErrorType>(
        "EMAIL_TAKEN",
        "Email is already in use.",
        409,
      );
    }

    if (phoneNumber) {
      const existingPhone = await findUserByIdentifier(db, phoneNumber);
      if (existingPhone) {
        throw new AppError<SignUpErrorType>(
          "PHONE_NUMBER_TAKEN",
          "Phone number is already in use.",
          409,
        );
      }
    }

    const passwordHash = await Bun.password.hash(password, {
      algorithm: "argon2id",
    });

    const user = await createUser(db, {
      email,
      passwordHash,
      phoneNumber,
      fullName,
      authProvider: "LOCAL",
      role: "PARENT",
      status: "ACTIVE",
    });

    return {
      id: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber ?? null,
      fullName: user.fullName ?? null,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    if (isPgErrorCode(error, PgErrorCode.UNIQUE_VIOLATION)) {
      throw mapUniqueViolation(error);
    }

    console.error(
      "[ERROR] Unexpected error in use case: Sign up parent",
      error,
    );
    throw new AppError<SignUpErrorType>(
      "INTERNAL_ERROR",
      "Internal server error.",
      500,
    );
  }
}
