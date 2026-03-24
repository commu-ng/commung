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

// Upload image helper - uses raw fetch because FormData with Hono RPC client
// has issues with Content-Type headers
export async function uploadImage(
  file: File,
): Promise<{ id: string; url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${env.apiBaseUrl}/console/upload/file`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(getErrorMessage(errorData, "이미지 업로드에 실패했습니다"));
  }

  const result = await response.json();
  return result.data;
}
