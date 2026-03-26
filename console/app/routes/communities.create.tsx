import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  type CommunityFormData,
  CommunityFormFields,
} from "~/components/CommunityFormFields";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { api, uploadImage } from "~/lib/api-client";
import { formatError } from "~/lib/errors";
import type { Route } from "./+types/communities.create";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "커뮤 등록" },
    { name: "description", content: "새로운 커뮤 홍보글을 등록하세요" },
  ];
}

export default function CreateCommunity() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<CommunityFormData>({
    name: "",
    slug: "",
    recruiting: false,
    minimum_birth_year: "",
    profile_username: "",
    profile_name: "",
    mute_new_members: false,
    show_all_replies: false,
    bump_on_reply: false,
  });
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [recruitingStartDate, setRecruitingStartDate] = useState<Date>();
  const [recruitingEndDate, setRecruitingEndDate] = useState<Date>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [_selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedImageId, setUploadedImageId] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setError("");
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      setError("이미지 파일만 업로드 가능합니다 (JPG, PNG, GIF, WebP)");
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("이미지 크기는 10MB 이하여야 합니다");
      return;
    }

    setSelectedImage(file);
    setError("");

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") {
        setImagePreview(result);
      }
    };
    reader.readAsDataURL(file);

    // Upload image immediately
    handleImageUpload(file);
  };

  const handleImageUpload = async (file: File) => {
    setIsUploadingImage(true);
    try {
      const uploadData = await uploadImage(file);
      setUploadedImageId(uploadData.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "이미지 업로드에 실패했습니다",
      );
      setSelectedImage(null);
      setImagePreview(null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setUploadedImageId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!startDate || !endDate) {
      setError("시작일과 종료일을 모두 선택해주세요");
      setIsLoading(false);
      return;
    }

    if (endDate <= startDate) {
      setError("종료일은 시작일보다 나중이어야 합니다");
      setIsLoading(false);
      return;
    }

    // Validate recruiting dates if provided
    if (recruitingStartDate && !recruitingEndDate) {
      setError("모집 시작일을 설정했다면 모집 종료일도 설정해주세요");
      setIsLoading(false);
      return;
    }

    if (!recruitingStartDate && recruitingEndDate) {
      setError("모집 종료일을 설정했다면 모집 시작일도 설정해주세요");
      setIsLoading(false);
      return;
    }

    if (
      recruitingStartDate &&
      recruitingEndDate &&
      recruitingEndDate <= recruitingStartDate
    ) {
      setError("모집 종료일은 모집 시작일보다 나중이어야 합니다");
      setIsLoading(false);
      return;
    }

    try {
      const requestBody = {
        name: formData.name,
        slug: formData.slug,
        starts_at: startDate.toISOString(),
        ends_at: endDate.toISOString(),
        is_recruiting: formData.recruiting,
        minimum_birth_year: formData.minimum_birth_year
          ? parseInt(formData.minimum_birth_year, 10)
          : null,
        image_id: uploadedImageId,
        hashtags: hashtags,
        recruiting_starts_at: recruitingStartDate?.toISOString() || null,
        recruiting_ends_at: recruitingEndDate?.toISOString() || null,
        profile_username: formData.profile_username,
        profile_name: formData.profile_name,
        mute_new_members: formData.mute_new_members,
        show_all_replies: formData.show_all_replies,
        bump_on_reply: formData.bump_on_reply,
      };

      await api.console.communities.$post({
        json: requestBody,
      });
      queryClient.invalidateQueries({ queryKey: ["communities", "mine"] });

      setSuccess(true);
      setTimeout(() => {
        navigate("/communities/mine");
      }, 2000);
    } catch (err) {
      setError(formatError(err, "커뮤 생성에 실패했습니다"));
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-background">
        <div className="container mx-auto py-8 px-4 max-w-2xl">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-green-600">
                커뮤 생성 완료
              </CardTitle>
              <CardDescription>
                커뮤가 성공적으로 생성되었습니다
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                잠시 후 내 커뮤 페이지로 이동합니다...
              </p>
              <Link to="/communities/mine">
                <Button className="w-full">내 커뮤 보기</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">커뮤 생성</CardTitle>
            <CardDescription>새로운 커뮤를 만들어보세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <CommunityFormFields
                formData={formData}
                onInputChange={handleInputChange}
                hashtags={hashtags}
                onHashtagsChange={setHashtags}
                startDate={startDate}
                onStartDateChange={setStartDate}
                endDate={endDate}
                onEndDateChange={setEndDate}
                recruitingStartDate={recruitingStartDate}
                onRecruitingStartDateChange={setRecruitingStartDate}
                recruitingEndDate={recruitingEndDate}
                onRecruitingEndDateChange={setRecruitingEndDate}
                isLoading={isLoading}
                showImageUpload={true}
                imagePreview={imagePreview}
                onImageSelect={handleImageSelect}
                onImageRemove={removeImage}
                isUploadingImage={isUploadingImage}
              />

              {error && (
                <div className="text-sm text-red-600 text-center">{error}</div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Spinner />}
                {isLoading ? "생성 중..." : "커뮤 생성"}
              </Button>
            </form>

            <div className="text-center text-sm">
              <Link to="/" className="text-primary hover:underline">
                홈으로 돌아가기
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
