import { db, withTx } from "../../db/client.ts";
import {
  findUserByIdentifier,
  createPasswordResetCode,
  findValidResetCode,
  updatePasswordTx,
} from "../../db/queries/user_queries.ts";
import { sendSms, SmsSendError } from "../../notifications/sms.ts";
import { AppError } from "../app_error.ts";
import * as nodemailer from "nodemailer";
import { randomInt, randomUUID } from "crypto";

export type PasswordResetErrorType =
  | "MISSING_IDENTIFIER"
  | "INVALID_CODE"
  | "EXPIRED_CODE"
  | "MISSING_PASSWORD"
  | "WEAK_PASSWORD"
  | "DELIVERY_FAILED"
  | "INTERNAL_ERROR";

const PASSWORD_RESET_OTP_TTL_MINUTES = 15;

function normalizeIdentifier(identifier: string): string {
  const value = identifier.trim();
  if (value.includes("@")) return value.toLowerCase();
  return value.replace(/[\s().-]/g, "");
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function requestPasswordReset(identifier: string) {
  if (!identifier) {
    throw new AppError<PasswordResetErrorType>(
      "MISSING_IDENTIFIER",
      "Email or phone number is required.",
      400,
    );
  }

  const normalizedIdentifier = normalizeIdentifier(identifier);

  try {
    const user = await findUserByIdentifier(db, normalizedIdentifier);
    if (!user || user.authProvider !== "LOCAL") {
      return { message: "If an account exists, a reset code has been sent." };
    }

    const otp = randomInt(100000, 999999).toString();
    const codeHash = await Bun.password.hash(otp, { algorithm: "argon2id" });
    const expiresAt = new Date(
      Date.now() + PASSWORD_RESET_OTP_TTL_MINUTES * 60 * 1000,
    ).toISOString();

    await createPasswordResetCode(db, {
      userId: user.id,
      codeHash,
      expiresAt,
    });

    if (normalizedIdentifier.includes("@")) {
      const transporter = getTransporter();
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"HMI App" <noreply@hmi.app>',
        to: user.email,
        subject: "Your Password Reset Code",
        text: `Your password reset code is: ${otp}. It expires in ${PASSWORD_RESET_OTP_TTL_MINUTES} minutes.`,
      });
    } else if (user.phoneNumber) {
      await sendSms({
        to: user.phoneNumber,
        body: `Your HMI password reset code is ${otp}. It expires in ${PASSWORD_RESET_OTP_TTL_MINUTES} minutes.`,
      });
    }

    return { message: "If an account exists, a reset code has been sent." };
  } catch (error) {
    if (error instanceof SmsSendError) {
      console.error("[ERROR] password reset SMS delivery failed:", {
        type: error.type,
        providerStatus: error.providerStatus,
        providerCode: error.providerCode,
        cause: error.cause,
      });
      throw new AppError<PasswordResetErrorType>(
        "DELIVERY_FAILED",
        "Unable to deliver password reset code.",
        error.type === "SMS_CONFIGURATION_ERROR" ? 500 : 502,
      );
    }

    console.error("[ERROR] requestPasswordReset:", error);
    throw new AppError<PasswordResetErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}

export async function verifyPasswordResetCode(identifier: string, otp: string) {
  if (!identifier || !otp) {
    throw new AppError<PasswordResetErrorType>(
      "MISSING_IDENTIFIER",
      "Identifier and code are required.",
      400,
    );
  }

  const normalizedIdentifier = identifier.trim().toLowerCase();

  try {
    const user = await findUserByIdentifier(db, normalizedIdentifier);
    if (!user) {
      throw new AppError<PasswordResetErrorType>("INVALID_CODE", "Invalid or expired code.", 400);
    }

    const validCodes = await db.query.passwordResetCodes.findMany({
      where: (codes, { and, eq, gt, isNull }) =>
        and(
          eq(codes.userId, user.id),
          gt(codes.expiresAt, new Date().toISOString()),
          isNull(codes.usedAt),
          isNull(codes.verifiedAt),
        ),
      orderBy: (codes, { desc }) => [desc(codes.createdAt)],
    });

    let matchedCode = null;
    for (const code of validCodes) {
      if (code.attemptCount >= 5) continue;

      const isValid = await Bun.password.verify(otp, code.codeHash);
      if (isValid) {
        matchedCode = code;
        break;
      } else {
        db.update(db._.fullSchema.passwordResetCodes);
      }
    }

    if (!matchedCode) {
      throw new AppError<PasswordResetErrorType>("INVALID_CODE", "Invalid or expired code.", 400);
    }

    const resetToken = randomUUID();
    const resetTokenHash = await Bun.password.hash(resetToken, { algorithm: "argon2id" });

    const { passwordResetCodes } = await import("../../db/schema.ts");
    const { eq } = await import("drizzle-orm");

    await db
      .update(passwordResetCodes)
      .set({
        verifiedAt: new Date().toISOString(),
        codeHash: resetTokenHash,
      })
      .where(eq(passwordResetCodes.id, matchedCode.id));

    return { resetToken, message: "Code verified successfully." };
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("[ERROR] verifyPasswordResetCode:", error);
    throw new AppError<PasswordResetErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}

export async function confirmPasswordReset(
  identifier: string,
  resetToken: string,
  newPassword: string,
) {
  if (!resetToken || !newPassword) {
    throw new AppError<PasswordResetErrorType>(
      "MISSING_PASSWORD",
      "Reset token and new password are required.",
      400,
    );
  }

  if (newPassword.length < 8) {
    throw new AppError<PasswordResetErrorType>(
      "WEAK_PASSWORD",
      "Password must be at least 8 characters.",
      400,
    );
  }

  try {
    const user = await findUserByIdentifier(db, identifier.trim().toLowerCase());
    if (!user) {
      throw new AppError<PasswordResetErrorType>("INVALID_CODE", "Invalid token.", 400);
    }

    const { passwordResetCodes } = await import("../../db/schema.ts");
    const { eq, and, isNotNull, isNull, gt } = await import("drizzle-orm");

    const verifiedCodes = await db.query.passwordResetCodes.findMany({
      where: and(
        eq(passwordResetCodes.userId, user.id),
        isNotNull(passwordResetCodes.verifiedAt),
        isNull(passwordResetCodes.usedAt),
        gt(passwordResetCodes.expiresAt, new Date().toISOString()),
      ),
    });

    let matchedCode = null;
    for (const code of verifiedCodes) {
      const isValid = await Bun.password.verify(resetToken, code.codeHash);
      if (isValid) {
        matchedCode = code;
        break;
      }
    }

    if (!matchedCode) {
      throw new AppError<PasswordResetErrorType>(
        "INVALID_CODE",
        "Invalid or expired reset token.",
        400,
      );
    }

    const newPasswordHash = await Bun.password.hash(newPassword, { algorithm: "argon2id" });

    await withTx(async (tx) => {
      await updatePasswordTx(tx, user.id, newPasswordHash, matchedCode!.id);
      const { sessions } = await import("../../db/schema.ts");
      await tx.delete(sessions).where(eq(sessions.userId, user.id));
    });

    return { message: "Password updated successfully." };
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("[ERROR] confirmPasswordReset:", error);
    throw new AppError<PasswordResetErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
