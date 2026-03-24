import type { AppType } from "@commu-ng/api";
import { hc } from "hono/client";
import { env } from "./env";

// API response types
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface ApiSuccessResponse<T> {
  data: T;
}

// Helper function to extract error message from API response
export function getErrorMessage(errorData: unknown, fallback: string): string {
  const data = errorData as { error?: { message?: string } | string };
  if (typeof data.error === "object" && data.error?.message) {
    return data.error.message;
  }
  if (typeof data.error === "string") {
    return data.error;
  }
  return fallback;
}

// Since the type resolution is causing issues, let's use a runtime solution
// where we still get the type safety at compile time but avoid the complex type inference
export const client = hc<AppType>(env.apiBaseUrl, {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => {
    return fetch(input, {
      ...init,
      credentials: "include",
    });
  },
});

// Export single unified API client
export const api = client;

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
): Promise<{ id: string; url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  return new Promise<{ id: string; url: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${env.apiBaseUrl}/console/upload/file`);
    xhr.withCredentials = true;

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
        let message = "이미지 업로드에 실패했습니다";
        try {
          const errorData = JSON.parse(xhr.responseText);
          message = getErrorMessage(errorData, message);
        } catch {
          // use default message
        }
        reject(new UploadError(message, false));
      }
    };

    xhr.onerror = () => {
      reject(new UploadError("네트워크 오류가 발생했습니다", true));
    };

    xhr.send(formData);
  });
}

// Upload image helper with retry logic for network/server errors
export async function uploadImage(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ id: string; url: string }> {
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
