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

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export interface UploadedImage {
  id: string;
  filename: string;
  url: string;
  width: number;
  height: number;
}

class UploadError extends Error {
  retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

function attemptUpload(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadedImage> {
  const formData = new FormData();
  formData.append("file", file);

  return new Promise<UploadedImage>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${env.apiBaseUrl}/app/upload/file`);
    xhr.setRequestHeader(
      "Authorization",
      `Bearer ${localStorage.getItem("session_token")}`,
    );

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve(data.data);
      } else if (xhr.status >= 500) {
        reject(new UploadError("서버 오류가 발생했습니다", true));
      } else {
        reject(new UploadError("이미지 업로드에 실패했습니다", false));
      }
    };

    xhr.onerror = () => {
      reject(new UploadError("네트워크 오류가 발생했습니다", true));
    };

    xhr.send(formData);
  });
}

export async function uploadImage(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadedImage> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await attemptUpload(file, onProgress);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (err instanceof UploadError && !err.retryable) {
        throw lastError;
      }
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, BASE_DELAY_MS * 2 ** attempt));
      }
    }
  }

  throw lastError || new Error("이미지 업로드에 실패했습니다");
}
