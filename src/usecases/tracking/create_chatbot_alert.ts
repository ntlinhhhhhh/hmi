import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { createAlert, updateAlertNotificationStatus } from "../../db/queries/alert_queries.ts";
import { deviceTokens } from "../../db/schema.ts";
import { sendPushNotification } from "../../notifications/firebase.ts";
import { AppError } from "../app_error.ts";
import {
  normalizeUseCaseUuid,
  requireOwnedActiveParentChild,
  type ParentChildAccessErrorType,
} from "../parent_child_access.ts";

export type AlertNotificationStatus = "PENDING" | "SENT" | "FAILED" | "NO_DEVICES";

export type ChatbotAlertResult = {
  id: string;
  childId: string;
  reason: string;
  source: "CHATBOT";
  notificationStatus: AlertNotificationStatus;
  notificationSentAt: string | null;
  notificationError: string | null;
  createdAt: string;
};

export type CreateChatbotAlertErrorType =
  | ParentChildAccessErrorType
  | "MISSING_REASON"
  | "INVALID_REASON"
  | "INTERNAL_ERROR";

export type CreateChatbotAlertInput = {
  parentId: string;
  childId: string;
  reason?: string;
};

const CHATBOT_WARNING_TITLE = "HMI - Chatbot Warnings";
const MAX_REASON_LENGTH = 1000;

function normalizeReason(reason: string | undefined): string {
  const value = reason?.trim().replace(/\s+/g, " ") ?? "";

  if (!value) {
    throw new AppError<CreateChatbotAlertErrorType>("MISSING_REASON", "reason is required.", 400);
  }

  if (value.length > MAX_REASON_LENGTH) {
    throw new AppError<CreateChatbotAlertErrorType>(
      "INVALID_REASON",
      `reason must be ${MAX_REASON_LENGTH} characters or fewer.`,
      400,
    );
  }

  return value;
}

function toChatbotAlertResult(row: {
  id: string;
  childId: string;
  reason: string;
  source: string;
  notificationStatus: string;
  notificationSentAt: string | null;
  notificationError: string | null;
  createdAt: string;
}): ChatbotAlertResult {
  const notificationStatus: AlertNotificationStatus =
    row.notificationStatus === "SENT" ||
    row.notificationStatus === "FAILED" ||
    row.notificationStatus === "NO_DEVICES"
      ? row.notificationStatus
      : "PENDING";

  return {
    id: row.id,
    childId: row.childId,
    reason: row.reason,
    source: "CHATBOT",
    notificationStatus,
    notificationSentAt: row.notificationSentAt ?? null,
    notificationError: row.notificationError ?? null,
    createdAt: row.createdAt,
  };
}

async function dispatchWarningPush(parentId: string, childId: string, reason: string) {
  const tokens = await db.query.deviceTokens.findMany({
    where: and(eq(deviceTokens.userId, parentId), eq(deviceTokens.isActive, true)),
  });

  if (tokens.length === 0) {
    return {
      status: "NO_DEVICES" as const,
      notificationSentAt: null,
      notificationError: null,
    };
  }

  const result = await sendPushNotification(
    tokens.map((token) => token.pushToken),
    CHATBOT_WARNING_TITLE,
    reason,
    {
      child_id: childId,
      alert_source: "CHATBOT",
    },
  );

  if (result.successCount > 0) {
    return {
      status: "SENT" as const,
      notificationSentAt: new Date().toISOString(),
      notificationError: result.failureCount > 0 ? `${result.failureCount} token(s) failed.` : null,
    };
  }

  return {
    status: "FAILED" as const,
    notificationSentAt: null,
    notificationError: `Push dispatch failed for ${result.failureCount} token(s).`,
  };
}

export async function createChatbotAlert(
  input: CreateChatbotAlertInput,
): Promise<ChatbotAlertResult> {
  const parentId = normalizeUseCaseUuid(
    input.parentId,
    "MISSING_PARENT_ID",
    "INVALID_PARENT_ID",
    "parent ID",
  );
  const childId = normalizeUseCaseUuid(
    input.childId,
    "MISSING_CHILD_ID",
    "INVALID_CHILD_ID",
    "child ID",
  );
  const reason = normalizeReason(input.reason);

  try {
    await requireOwnedActiveParentChild({ parentId, childId });

    const alert = await createAlert(db, {
      childId,
      reason,
      source: "CHATBOT",
      notificationStatus: "PENDING",
      notificationSentAt: null,
      notificationError: null,
    });

    const dispatchResult = await dispatchWarningPush(parentId, childId, reason);
    const updatedAlert = await updateAlertNotificationStatus(db, alert.id, {
      notificationStatus: dispatchResult.status,
      notificationSentAt: dispatchResult.notificationSentAt,
      notificationError: dispatchResult.notificationError,
    });

    return toChatbotAlertResult(updatedAlert);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("[ERROR] Unexpected error in use case: Create chatbot alert", error);
    throw new AppError<CreateChatbotAlertErrorType>(
      "INTERNAL_ERROR",
      "Internal server error.",
      500,
    );
  }
}

export { toChatbotAlertResult };
