import { randomUUID } from "crypto";
import { db } from "../../../db/client.ts";
import { mediaAssets } from "../../../db/schema.ts";
import { getFileUrl, uploadFile } from "../../../storage/s3.ts";
import { AppError } from "../../app_error.ts";

export type CreateMediaAssetErrorType =
  | "MISSING_ADMIN_ID"
  | "MISSING_FILE"
  | "INVALID_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "STORAGE_ERROR"
  | "INVALID_PURPOSE"
  | "INTERNAL_ERROR";

export type CreateMediaAssetInput = {
  adminId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  purpose: string;
  buffer: Uint8Array;
};

export type MediaAssetResult = {
  id: string;
  fileName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  purpose: string;
  createdBy: string;
  url: string;
  createdAt: string;
};

const maxFileBytes = 50 * 1024 * 1024; // 50 MB

export async function createMediaAsset(
  input: CreateMediaAssetInput,
): Promise<MediaAssetResult> {
  const adminId = input.adminId.trim();
  if (!adminId) {
    throw new AppError<CreateMediaAssetErrorType>(
      "MISSING_ADMIN_ID",
      "Admin ID is required.",
      400,
    );
  }

  const fileName = input.fileName.trim();
  if (!fileName) {
    throw new AppError<CreateMediaAssetErrorType>(
      "MISSING_FILE",
      "File name is required.",
      400,
    );
  }

  const purpose = input.purpose.trim();
  if (!purpose) {
    throw new AppError<CreateMediaAssetErrorType>(
      "INVALID_PURPOSE",
      "Purpose is required.",
      400,
    );
  }

  if (input.sizeBytes <= 0 || input.buffer.byteLength === 0) {
    throw new AppError<CreateMediaAssetErrorType>(
      "MISSING_FILE",
      "File cannot be empty.",
      400,
    );
  }

  if (input.sizeBytes > maxFileBytes || input.buffer.byteLength > maxFileBytes) {
    throw new AppError<CreateMediaAssetErrorType>(
      "FILE_TOO_LARGE",
      "File size must be 50 MB or smaller.",
      413,
    );
  }

  const assetId = randomUUID();
  // Safe file extension parsing
  const parts = fileName.split(".");
  const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : "";
  const baseName = parts.join("").replace(/[^a-zA-Z0-9_-]/g, "_");
  const cleanFileName = ext ? `${baseName}.${ext}` : baseName;

  const storageKey = `media-assets/${assetId}-${cleanFileName}`;

  try {
    // 1. Upload to S3
    await uploadFile(storageKey, input.buffer, input.mimeType);
  } catch (error) {
    console.error("[ERROR] Failed to upload media asset to S3:", error);
    throw new AppError<CreateMediaAssetErrorType>(
      "STORAGE_ERROR",
      "Failed to upload file to storage.",
      502,
    );
  }

  try {
    // 2. Insert into database
    const [inserted] = await db
      .insert(mediaAssets)
      .values({
        id: assetId,
        fileName: cleanFileName,
        storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        purpose,
        createdBy: adminId,
      })
      .returning();

    if (!inserted) {
      throw new Error("Failed to insert media asset record.");
    }

    // 3. Return the result metadata along with signed URL
    const url = await getFileUrl(storageKey);

    return {
      id: inserted.id,
      fileName: inserted.fileName,
      storageKey: inserted.storageKey,
      mimeType: inserted.mimeType,
      sizeBytes: inserted.sizeBytes,
      purpose: inserted.purpose,
      createdBy: inserted.createdBy,
      url,
      createdAt: inserted.createdAt,
    };
  } catch (error: unknown) {
    console.error("[ERROR] Unexpected error in createMediaAsset use case:", error);
    throw new AppError<CreateMediaAssetErrorType>(
      "INTERNAL_ERROR",
      "Internal server error.",
      500,
    );
  }
}
