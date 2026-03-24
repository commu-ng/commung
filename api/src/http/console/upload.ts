import { Hono } from "hono";
import sharp from "sharp";
import { authMiddleware } from "../../middleware/auth";
import * as imageService from "../../services/image.service";
import { GeneralErrorCode } from "../../types/api-responses";
import {
  getFileUrl,
  uploadFileDirect,
  validateImageFile,
} from "../../utils/r2";

export const uploadRouter = new Hono().post(
  "/upload/file",
  authMiddleware,
  async (c) => {
    // User is authenticated via authMiddleware

    // Check Content-Type before parsing formData
    const requestContentType = c.req.header("content-type") || "";
    if (
      !requestContentType.startsWith("multipart/form-data") &&
      !requestContentType.startsWith("application/x-www-form-urlencoded")
    ) {
      return c.json(
        {
          error: {
            code: GeneralErrorCode.INVALID_CONTENT_TYPE,
            message:
              'Content-Type은 "multipart/form-data" 또는 "application/x-www-form-urlencoded"여야 합니다',
          },
        },
        400,
      );
    }

    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return c.json(
        {
          error: {
            code: GeneralErrorCode.NO_FILE_UPLOADED,
            message: "업로드된 파일이 없습니다",
          },
        },
        400,
      );
    }
    const fileBuffer = await file.arrayBuffer();
    const contentType = file.type || "";

    const [isValid, errorMessage] = validateImageFile(
      contentType,
      file.size,
      file.name,
    );
    if (!isValid) {
      return c.json(
        {
          error: {
            code: GeneralErrorCode.INVALID_FILE,
            message: errorMessage,
          },
        },
        400,
      );
    }

    const uniqueKey = await uploadFileDirect(
      fileBuffer,
      file.name,
      contentType,
    );

    // Use sharp to get image dimensions
    let width = 0;
    let height = 0;
    const image = sharp(Buffer.from(fileBuffer));
    const metadata = await image.metadata();
    width = metadata.width ?? 0;
    height = metadata.height ?? 0;

    const newImage = await imageService.createImageRecord(
      uniqueKey,
      file.name,
      width,
      height,
    );

    return c.json(
      {
        data: {
          id: newImage.id,
          filename: newImage.filename,
          width: newImage.width,
          height: newImage.height,
          url: getFileUrl(newImage.key),
          key: uniqueKey,
          created_at: newImage.createdAt,
        },
      },
      201,
    );
  },
);
