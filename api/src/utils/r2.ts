import type { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import sharp from "sharp";
import { env } from "../config/env";
import { POST_CONFIG } from "../config/post.config";
import { logger } from "../config/logger";
import { R2_KEY_PREFIXES } from "../constants/r2";

const s3Client = new S3Client({
  region: "auto",
  endpoint: env.r2.endpointUrl,
  credentials: {
    accessKeyId: env.r2.accessKeyId,
    secretAccessKey: env.r2.secretAccessKey,
  },
});

export function getFileUrl(key: string): string {
  return `${env.r2.publicUrl}/${key}`;
}

export function addImageUrl<
  T extends { key: string; createdAt: string; deletedAt: string | null },
>(
  image: T,
): Omit<T, "createdAt" | "deletedAt"> & {
  url: string;
  created_at: string;
  deleted_at: string | null;
} {
  const { createdAt, deletedAt, ...rest } = image;
  return {
    ...(rest as Omit<T, "createdAt" | "deletedAt">),
    url: getFileUrl(image.key),
    created_at: createdAt,
    deleted_at: deletedAt,
  };
}

/**
 * Optimize an image: resize if exceeding max dimension and compress.
 * Skips GIFs to preserve animation.
 */
export async function optimizeImage(
  buffer: Buffer,
  contentType: string,
  maxDimension = 2048,
  quality = 80,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  // Skip GIFs to preserve animation
  if (contentType === "image/gif") {
    const metadata = await sharp(buffer).metadata();
    return {
      buffer,
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  }

  let pipeline = sharp(buffer).rotate(); // auto-rotate based on EXIF

  const metadata = await sharp(buffer).metadata();
  const { width, height } = metadata;

  // Resize if either dimension exceeds the max
  if ((width && width > maxDimension) || (height && height > maxDimension)) {
    pipeline = pipeline.resize(maxDimension, maxDimension, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // Compress based on format
  if (
    contentType === "image/jpeg" ||
    contentType === "image/jpg" ||
    contentType === "image/heic" ||
    contentType === "image/heif"
  ) {
    pipeline = pipeline.jpeg({ quality });
  } else if (contentType === "image/png") {
    pipeline = pipeline.png({ quality });
  } else if (contentType === "image/webp") {
    pipeline = pipeline.webp({ quality });
  }

  const optimizedBuffer = await pipeline.toBuffer();
  const optimizedMetadata = await sharp(optimizedBuffer).metadata();

  return {
    buffer: optimizedBuffer,
    width: optimizedMetadata.width || 0,
    height: optimizedMetadata.height || 0,
  };
}

export async function uploadFileDirect(
  fileContent: ArrayBuffer,
  filename: string,
  contentType: string,
): Promise<string> {
  const fileExtension = filename.split(".").pop() || "";
  const uniqueKey = `${R2_KEY_PREFIXES.IMAGE}/${crypto.randomUUID()}.${fileExtension}`;

  const uploadParams = {
    Bucket: env.r2.bucketName,
    Key: uniqueKey,
    Body: Buffer.from(fileContent),
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
    ContentDisposition: "inline",
  };

  await s3Client.send(new PutObjectCommand(uploadParams));
  return uniqueKey;
}

export function validateImageFile(
  contentType: string,
  fileSize: number,
  filename?: string,
): [boolean, string] {
  if (!POST_CONFIG.IMAGE.ALLOWED_MIME_TYPES.includes(contentType)) {
    return [false, "Only image files are allowed"];
  }

  if (filename) {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (!POST_CONFIG.IMAGE.ALLOWED_EXTENSIONS.includes(ext)) {
      return [false, "File extension is not allowed"];
    }
  }

  if (fileSize > POST_CONFIG.IMAGE.MAX_FILE_SIZE) {
    const maxMb = POST_CONFIG.IMAGE.MAX_FILE_SIZE / (1024 * 1024);
    return [false, `File size must be less than ${maxMb}MB`];
  }

  if (fileSize === 0) {
    return [false, "File cannot be empty"];
  }

  return [true, ""];
}

export async function deleteFile(key: string): Promise<boolean> {
  try {
    const deleteParams = {
      Bucket: env.r2.bucketName,
      Key: key,
    };
    await s3Client.send(new DeleteObjectCommand(deleteParams));
    return true;
  } catch (error) {
    logger.service.error("Failed to delete file from R2", { key, error });
    return false;
  }
}

export async function uploadExportFile(
  stream: Readable,
  filename: string,
): Promise<string> {
  const uniqueKey = `${R2_KEY_PREFIXES.EXPORT}/${crypto.randomUUID()}-${filename}`;

  // Use Upload class for streaming without known content length
  // It handles multipart uploads automatically for large files
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: env.r2.bucketName,
      Key: uniqueKey,
      Body: stream,
      ContentType: "application/zip",
      CacheControl: "private, max-age=3600",
      ContentDisposition: `attachment; filename="${filename}"`,
    },
  });

  await upload.done();
  return uniqueKey;
}
