import {
  type CommunityFormData,
  CommunityFormFields,
} from "~/components/CommunityFormFields";
import { MarkdownEditor } from "~/components/MarkdownEditor";
import { PageHeader } from "~/components/shared/PageHeader";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { Spinner } from "~/components/ui/spinner";

// Settings form data excludes profile fields which are only needed for creation
type CommunitySettingsFormData = Omit<
  CommunityFormData,
  "profile_username" | "profile_name"
>;

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Settings, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api, getErrorMessage, uploadImage } from "~/lib/api-client";
import type { Route } from "./+types/communities.$slug.settings";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "커뮤 설정" },
    {
      name: "description",
      content: "커뮤를 수정하거나 삭제할 수 있습니다",
    },
  ];
}

interface Community {
  id: string;
  name: string;
  slug: string;
  starts_at: string;
  ends_at: string;
  is_recruiting: boolean;
  recruiting_starts_at?: string | null;
  recruiting_ends_at?: string | null;
  minimum_birth_year?: number | null;
  created_at: string;
  user_role: string | null;
  custom_domain: string | null;
  domain_verified: string | null;
  banner_image_url?: string | null;
  banner_image_width?: number | null;
  banner_image_height?: number | null;
  hashtags?: { id: string; tag: string }[];
  description?: string | null;
  mute_new_members?: boolean;
  show_all_replies?: boolean;
  bump_on_reply?: boolean;
}

// Fetch function
async function fetchCommunity(slug: string): Promise<Community> {
  const response = await api.console.communities[":id"].$get({
    param: { id: slug },
  });
  if (!response.ok) {
    throw new Error("커뮤를 찾을 수 없습니다");
  }
  const result = await response.json();
  return result.data;
}

export default function CommunityManagement() {
  const { slug } = useParams();
  const queryClient = useQueryClient();
  const deleteConfirmId = useId();
  const [formData, setFormData] = useState<CommunitySettingsFormData>({
    name: "",
    slug: "",
    recruiting: false,
    minimum_birth_year: "",
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState("");
  const [_selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedImageId, setUploadedImageId] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [description, setDescription] = useState<string>("");
  const [descriptionImageIds, setDescriptionImageIds] = useState<string[]>([]);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch community data
  const {
    data: community,
    isLoading: isCommunityLoading,
    error: communityError,
  } = useQuery({
    queryKey: ["community", slug],
    queryFn: () => fetchCommunity(slug ?? ""),
    enabled: !!slug,
  });

  const userRole = community?.user_role as
    | "owner"
    | "moderator"
    | "member"
    | null;

  // Initialize form when community data loads
  useEffect(() => {
    if (community) {
      setFormData({
        name: community.name,
        slug: community.slug,
        recruiting: community.is_recruiting,
        minimum_birth_year: community.minimum_birth_year
          ? String(community.minimum_birth_year)
          : "",
        mute_new_members: community.mute_new_members ?? false,
        show_all_replies: community.show_all_replies ?? false,
        bump_on_reply: community.bump_on_reply ?? false,
      });

      if (community.banner_image_url) {
        setImagePreview(community.banner_image_url);
      }
      setStartDate(new Date(community.starts_at));
      setEndDate(new Date(community.ends_at));
      setRecruitingStartDate(
        community.recruiting_starts_at
          ? new Date(community.recruiting_starts_at)
          : undefined,
      );
      setRecruitingEndDate(
        community.recruiting_ends_at
          ? new Date(community.recruiting_ends_at)
          : undefined,
      );

      if (community.hashtags) {
        setHashtags(community.hashtags.map((h) => h.tag));
      }

      if (community.description) {
        setDescription(community.description);
      }
    }
  }, [community]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setError("");
    setSuccess("");
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
    setSuccess("");

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

  const handleDescriptionImageUpload = async (
    file: File,
  ): Promise<{ url: string; id: string }> => {
    try {
      const uploadData = await uploadImage(file);

      // Track this image ID for description
      setDescriptionImageIds((prev) => [...prev, uploadData.id]);

      return {
        id: uploadData.id,
        url: uploadData.url,
      };
    } catch (err) {
      console.error("Description image upload failed:", err);
      throw err;
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

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

    // Validate recruiting dates if both are provided
    if (recruitingStartDate && recruitingEndDate) {
      if (recruitingEndDate <= recruitingStartDate) {
        setError("모집 종료일은 모집 시작일보다 나중이어야 합니다");
        setIsLoading(false);
        return;
      }
    }

    // Validate that recruiting dates are either both provided or both empty
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
        description: description || null,
        description_image_ids: descriptionImageIds,
        mute_new_members: formData.mute_new_members,
        show_all_replies: formData.show_all_replies,
        bump_on_reply: formData.bump_on_reply,
      };

      if (!community?.id) {
        throw new Error("Community ID is required");
      }
      const response = await api.console.communities[":id"].$put({
        param: { id: community.id },
        json: requestBody,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(getErrorMessage(errorData, "커뮤 수정에 실패했습니다"));
      }

      // Invalidate the communities query cache to refresh the list
      queryClient.invalidateQueries({ queryKey: ["communities", "mine"] });
      // Invalidate the specific community query to refresh the detail page
      queryClient.invalidateQueries({ queryKey: ["community", slug] });

      setSuccess("커뮤가 성공적으로 수정되었습니다");
    } catch (err) {
      setError(err instanceof Error ? err.message : "커뮤 수정에 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError("");

    try {
      if (!community?.id) {
        throw new Error("Community ID is required");
      }
      await api.console.communities[":id"].$delete({
        param: { id: community.id },
      });

      // Invalidate the communities query cache to refresh the list
      queryClient.invalidateQueries({ queryKey: ["communities", "mine"] });

      navigate("/communities/mine");
    } catch (err) {
      setError(err instanceof Error ? err.message : "커뮤 삭제에 실패했습니다");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (isCommunityLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-9 w-32" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Check if user has permission to access settings (owners only)
  const hasAccess = userRole === "owner";

  if (communityError || error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-destructive mb-4">
                {error ||
                  (communityError as Error)?.message ||
                  "오류가 발생했습니다"}
              </div>
              <Link to="/communities/mine">
                <Button variant="outline">내 커뮤로 돌아가기</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                커뮤 설정
              </CardTitle>
              <CardDescription>
                커뮤 설정 권한이 없습니다. 커뮤 소유자만 설정을 변경할 수
                있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <Link to={`/communities/${slug}`}>
                  <Button variant="outline">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    커뮤로 돌아가기
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-2">
          <Link to={`/communities/${slug}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              커뮤로 돌아가기
            </Button>
          </Link>
        </div>

        <PageHeader
          eyebrow="설정"
          icon={Settings}
          title="커뮤 설정"
          description="커뮤 정보와 운영 옵션을 조정해요"
          tone="lilac"
        />

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleUpdate} className="space-y-4">
              <CommunityFormFields
                formData={{
                  ...formData,
                  profile_username: "",
                  profile_name: "",
                }}
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
                existingCommunity={
                  community
                    ? {
                        starts_at: community.starts_at,
                        ends_at: community.ends_at,
                      }
                    : null
                }
              />

              <Separator className="my-6" />

              <div className="space-y-2">
                <Label>커뮤 소개</Label>
                <MarkdownEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="커뮤에 대한 소개를 작성해주세요..."
                  disabled={isLoading}
                  onImageUpload={handleDescriptionImageUpload}
                />
                <p className="text-xs text-muted-foreground">
                  커뮤에 대한 자세한 설명을 작성하고 이미지를 추가할 수 있습니다
                </p>
              </div>

              {error && (
                <div className="text-sm text-destructive text-center">
                  {error}
                </div>
              )}

              {success && (
                <div className="text-sm text-mint-ink text-center">
                  {success}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Spinner />}
                {isLoading ? "수정 중..." : "커뮤 수정"}
              </Button>
            </form>

            <Separator className="my-4" />
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              커뮤 삭제
            </Button>
          </CardContent>
        </Card>

        <Dialog
          open={showDeleteConfirm}
          onOpenChange={(open) => {
            setShowDeleteConfirm(open);
            if (!open) {
              setDeleteConfirmSlug("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>커뮤 삭제 확인</DialogTitle>
              <DialogDescription>
                정말로 이 커뮤를 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며,
                모든 데이터가 영구적으로 삭제됩니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={deleteConfirmId}>
                  삭제를 확인하려면{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                    {community?.slug}
                  </code>
                  를 입력하세요
                </Label>
                <Input
                  id={deleteConfirmId}
                  type="text"
                  value={deleteConfirmSlug}
                  onChange={(e) => setDeleteConfirmSlug(e.target.value)}
                  placeholder={community?.slug}
                  disabled={isDeleting}
                  autoComplete="off"
                />
              </div>

              {error && <div className="text-sm text-destructive">{error}</div>}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmSlug("");
                }}
                disabled={isDeleting}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting || deleteConfirmSlug !== community?.slug}
              >
                {isDeleting && <Spinner />}
                {isDeleting ? "삭제 중..." : "삭제"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
