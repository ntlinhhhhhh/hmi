import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env["S3_ENDPOINT"]?.trim();
const presignEndpoint = process.env["S3_PRESIGN_ENDPOINT"]?.trim() || endpoint;
const region = process.env["S3_REGION"]?.trim() || "us-east-1";
const forcePathStyle = process.env["S3_FORCE_PATH_STYLE"] === "true";
const createBucketIfMissing = process.env["S3_CREATE_BUCKET_IF_MISSING"] === "true";

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required S3 environment variable: ${name}.`);
  }
  return value;
}

const bucketName = readRequiredEnv("S3_BUCKET_NAME");
const credentials = {
  accessKeyId: readRequiredEnv("S3_ACCESS_KEY_ID"),
  secretAccessKey: readRequiredEnv("S3_SECRET_ACCESS_KEY"),
};

const clientConfig: S3ClientConfig = {
  region,
  credentials,
  forcePathStyle,
};

const s3Client = new S3Client({
  ...clientConfig,
  ...(endpoint ? { endpoint } : {}),
});

const presignClient = new S3Client({
  ...clientConfig,
  ...(presignEndpoint ? { endpoint: presignEndpoint } : {}),
});

async function ensureBucket(): Promise<void> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`[INFO] Connected to S3 bucket '${bucketName}'.`);
  } catch (error) {
    if (!createBucketIfMissing) {
      throw error;
    }

    await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
    console.log(`[INFO] Created S3 bucket '${bucketName}'.`);
  }
}

await ensureBucket().catch((error: unknown) => {
  console.error(`[ERROR] Failed to initialize S3 bucket '${bucketName}'.`, error);
  process.exit(1);
});

export async function uploadFile(
  objectKey: string,
  buffer: Uint8Array,
  contentType: string,
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
    }),
  );
}

export async function deleteFile(objectKey: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }),
  );
}

export async function getFileUrl(objectKey: string, expiresInSeconds = 900): Promise<string> {
  const key = objectKey.trim();
  if (!key) {
    throw new Error("S3 object key must not be empty.");
  }

  return await getSignedUrl(
    presignClient,
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
    { expiresIn: expiresInSeconds },
  );
}
