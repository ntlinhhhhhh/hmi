import { db } from "../../db/client.ts";
import { getChildProfileById } from "../../db/queries/child_profile_queries.ts";
import { getEmotionStats, getMeltdownAlerts } from "../../db/queries/tracking_queries.ts";
import { getLearningSummary } from "../../db/queries/learning_queries.ts";
import { getUserById } from "../../db/queries/user_queries.ts";
import { isValidUuid } from "../../utils/validation.ts";
import { AppError } from "../app_error.ts";

export type GetChildDashboardErrorType =
  | "MISSING_PARENT_ID"
  | "INVALID_PARENT_ID"
  | "MISSING_CHILD_ID"
  | "INVALID_CHILD_ID"
  | "INVALID_DAYS"
  | "PARENT_NOT_FOUND"
  | "CHILD_NOT_FOUND"
  | "CHILD_NOT_OWNED_BY_PARENT"
  | "INTERNAL_ERROR";

export type GetChildDashboardInput = {
  parentId: string;
  childId: string;
  days?: number;
};

export type ChildDashboardResult = {
  child: {
    id: string;
    nickname: string;
    totalStars: number;
    birthYear: number;
  };
  learning: {
    totalSessions: number;
    completedSessions: number;
    totalStars: number;
    correctAnswers: number;
    totalQuizzes: number;
    successRate: number;
  };
  emotions: Array<{
    emotion: string;
    count: number;
  }>;
  meltdownAlerts: Array<{
    id: string;
    emotionValue: string;
    triggerSource: string;
    durationSeconds: number | null;
    createdAt: string;
  }>;
};

function normalizeUuid(
  value: string,
  missingType: GetChildDashboardErrorType,
  invalidType: GetChildDashboardErrorType,
  label: string,
): string {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new AppError<GetChildDashboardErrorType>(missingType, `${label} is required.`, 400);
  }

  if (!isValidUuid(normalizedValue)) {
    throw new AppError<GetChildDashboardErrorType>(
      invalidType,
      `Invalid ${label.toLowerCase()} format.`,
      400,
    );
  }

  return normalizedValue;
}

function normalizeDays(days: number | undefined): number {
  if (days === undefined) return 7;

  if (!Number.isInteger(days) || days < 1 || days > 90) {
    throw new AppError<GetChildDashboardErrorType>(
      "INVALID_DAYS",
      "Days must be an integer from 1 to 90.",
      400,
    );
  }

  return days;
}

export async function getChildDashboard(
  input: GetChildDashboardInput,
): Promise<ChildDashboardResult> {
  const parentId = normalizeUuid(
    input.parentId,
    "MISSING_PARENT_ID",
    "INVALID_PARENT_ID",
    "Parent ID",
  );
  const childId = normalizeUuid(input.childId, "MISSING_CHILD_ID", "INVALID_CHILD_ID", "Child ID");
  const days = normalizeDays(input.days);

  try {
    const [parent, child] = await Promise.all([
      getUserById(db, parentId),
      getChildProfileById(db, childId),
    ]);

    if (!parent || parent.role !== "PARENT") {
      throw new AppError<GetChildDashboardErrorType>(
        "PARENT_NOT_FOUND",
        "Parent account not found.",
        404,
      );
    }

    if (!child) {
      throw new AppError<GetChildDashboardErrorType>(
        "CHILD_NOT_FOUND",
        "Child profile not found.",
        404,
      );
    }

    if (child.parentId !== parentId) {
      throw new AppError<GetChildDashboardErrorType>(
        "CHILD_NOT_OWNED_BY_PARENT",
        "Child profile does not belong to this parent.",
        403,
      );
    }

    const [learningSummary, emotionStats, meltdownAlerts] = await Promise.all([
      getLearningSummary(db, childId),
      getEmotionStats(db, childId, days),
      getMeltdownAlerts(db, childId, days),
    ]);

    return {
      child: {
        id: child.id,
        nickname: child.nickname,
        totalStars: child.totalStars,
        birthYear: child.birthYear,
      },
      learning: {
        totalSessions: Number(learningSummary.totalSessions ?? 0),
        completedSessions: Number(learningSummary.completedSessions ?? 0),
        totalStars: Number(learningSummary.totalStars ?? 0),
        correctAnswers: Number(learningSummary.correctAnswers ?? 0),
        totalQuizzes: Number(learningSummary.totalQuizzes ?? 0),
        successRate: Number(learningSummary.successRate ?? 0),
      },
      emotions: emotionStats.map((row) => ({
        emotion: row.emotion,
        count: Number(row.count),
      })),
      meltdownAlerts: meltdownAlerts.map((log) => ({
        id: log.id,
        emotionValue: log.emotionValue,
        triggerSource: log.triggerSource,
        durationSeconds: log.durationSeconds ?? null,
        createdAt: log.createdAt,
      })),
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("[ERROR] Unexpected error in use case: Get child dashboard", error);
    throw new AppError<GetChildDashboardErrorType>("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
