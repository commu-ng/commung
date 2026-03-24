import { env } from "~/lib/env";

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
];

export const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface UploadedImage {
  id: string;
  filename: string;
  url: string;
  width: number;
  height: number;
}

export async function uploadImage(file: File): Promise<UploadedImage> {
  const formData = new FormData();
  formData.append("file", file);

  const uploadResponse = await fetch(`${env.apiBaseUrl}/app/upload/file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("session_token")}`,
    },
    body: formData,
  });

  if (!uploadResponse.ok) {
    throw new Error("이미지 업로드에 실패했습니다");
  }

  const uploadData = await uploadResponse.json();
  return uploadData.data;
}
