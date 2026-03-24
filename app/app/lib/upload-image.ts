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

export async function uploadImage(
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
      } else {
        reject(new Error("이미지 업로드에 실패했습니다"));
      }
    };

    xhr.onerror = () => {
      reject(new Error("네트워크 오류가 발생했습니다"));
    };

    xhr.send(formData);
  });
}
