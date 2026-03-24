import { useState } from "react";
import { toast } from "sonner";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_FILE_SIZE,
  uploadImage,
} from "~/lib/api-client";

interface UseImageUploadReturn {
  /**
   * Selected image file
   */
  selectedImage: File | null;
  /**
   * Image preview URL
   */
  imagePreview: string | null;
  /**
   * Uploaded image ID from the server
   */
  uploadedImageId: string | null;
  /**
   * Upload progress percentage (0-100), null when not uploading
   */
  uploadProgress: number | null;
  /**
   * Whether image is currently being uploaded
   */
  isUploadingImage: boolean;
  /**
   * Handle file selection from input
   */
  handleImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  /**
   * Remove the selected image
   */
  removeImage: () => void;
  /**
   * Clear all state
   */
  clearImage: () => void;
  /**
   * Set existing image (for edit mode)
   */
  setExistingImage: (url: string, imageId?: string) => void;
}

const ALLOWED_TYPES = ALLOWED_IMAGE_TYPES;
const MAX_FILE_SIZE = MAX_IMAGE_FILE_SIZE;

/**
 * Custom hook for handling image uploads in console
 */
export function useImageUpload(): UseImageUploadReturn {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedImageId, setUploadedImageId] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("이미지 파일만 업로드 가능합니다 (JPG, PNG, GIF, WebP)");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error("이미지 크기는 10MB 이하여야 합니다");
      return;
    }

    setSelectedImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") {
        setImagePreview(result);
      }
    };
    reader.readAsDataURL(file);

    // Upload the file
    setIsUploadingImage(true);
    setUploadProgress(0);
    try {
      const imageId = await uploadImage(file, (percent) => {
        setUploadProgress(percent);
      });
      setUploadedImageId(imageId.id);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "이미지 업로드에 실패했습니다",
      );
      // Clear on error
      setSelectedImage(null);
      setImagePreview(null);
    } finally {
      setIsUploadingImage(false);
      setUploadProgress(null);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setUploadedImageId(null);
  };

  const clearImage = () => {
    removeImage();
  };

  const setExistingImage = (url: string, imageId?: string) => {
    setImagePreview(url);
    if (imageId) {
      setUploadedImageId(imageId);
    }
  };

  return {
    selectedImage,
    imagePreview,
    uploadedImageId,
    uploadProgress,
    isUploadingImage,
    handleImageSelect,
    removeImage,
    clearImage,
    setExistingImage,
  };
}
