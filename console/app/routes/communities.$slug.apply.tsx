import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  Hash,
  LogIn,
  Sparkles,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { MarkdownEditor } from "~/components/MarkdownEditor";
import { PageHeader } from "~/components/shared/PageHeader";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";
import { api, getErrorMessage, uploadImage } from "~/lib/api-client";
import type { Route } from "./+types/communities.$slug.apply";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "커뮤 가입 신청" },
    {
      name: "description",
      content: "커뮤에 가입 신청하세요",
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
  recruiting_starts_at: string | null;
  recruiting_ends_at: string | null;
  minimum_birth_year: number | null;
  created_at: string;
  custom_domain: string | null;
  domain_verified: string | null;
  banner_image_url?: string | null;
  banner_image_width?: number | null;
  banner_image_height?: number | null;
  hashtags?: { id: string; tag: string }[];
  membership_status: string | null;
  application_status?: {
    status: string;
    application_id: string;
    created_at: string;
    message: string | null;
    rejection_reason: string | null;
    attachments: {
      id: string;
      image_id: string;
      image_url: {
        key: string;
        id: string;
        created_at: string;
        deleted_at: string | null;
        width: number;
        height: number;
        filename: string;
        url: string;
      };
      created_at: string;
    }[];
  } | null;
  user_role: string | null;
}

async function fetchCommunity(slug: string): Promise<Community> {
  const res = await api.console.communities[":id"].$get({
    param: { id: slug },
  });
  if (!res.ok) {
    const error = new Error("커뮤를 찾을 수 없습니다");
    (error as { status?: number }).status = res.status;
    throw error;
  }
  const result = await res.json();
  return result.data;
}

interface UserApplication {
  id: string;
  status: string;
  profile_name: string;
  profile_username: string;
  message: string | null;
  rejection_reason: string | null;
  created_at: string;
  attachments: Array<{
    id: string;
    image_id: string;
    image_url: {
      key: string;
      id: string;
      created_at: string;
      deleted_at: string | null;
      width: number;
      height: number;
      filename: string;
      url: string;
    };
    created_at: string;
  }>;
}

async function fetchMyApplications(slug: string): Promise<UserApplication[]> {
  const res = await api.console.communities[":id"]["my-applications"].$get({
    param: { id: slug },
  });
  if (!res.ok) {
    throw new Error("지원 내역을 불러올 수 없습니다");
  }
  const result = await res.json();
  return result.data;
}

export default function CommunityApply({ params }: Route.ComponentProps) {
  const { slug } = params;
  const navigate = useNavigate();
  const profileNameId = useId();
  const profileUsernameId = useId();
  const [message, setMessage] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState<
    { id: string; url: string }[]
  >([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();

  const {
    data: community,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["community", slug],
    queryFn: () => fetchCommunity(slug),
  });

  const { data: myApplications = [] } = useQuery({
    queryKey: ["my-applications", slug],
    queryFn: () => fetchMyApplications(slug),
    enabled: !!user && !!slug,
  });

  const errorStatus = error ? (error as { status?: number }).status : undefined;

  // Redirect to community details if user is already a member
  useEffect(() => {
    if (community && community.membership_status === "member") {
      navigate(`/communities/${slug}`, { replace: true });
    }
  }, [community, slug, navigate]);

  // Handle image selection and upload for attachments
  const _handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드할 수 있습니다");
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("파일 크기는 10MB 이하여야 합니다");
      return;
    }

    setIsUploadingImage(true);
    try {
      const uploadData = await uploadImage(file);

      // Add to attachments
      setAttachmentIds((prev) => [...prev, uploadData.id]);
      setAttachmentPreviews((prev) => [
        ...prev,
        { id: uploadData.id, url: URL.createObjectURL(file) },
      ]);

      toast.success("이미지가 업로드되었습니다");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "이미지 업로드에 실패했습니다",
      );
    } finally {
      setIsUploadingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle inline image upload for TiptapEditor
  const handleMessageImageUpload = async (
    file: File,
  ): Promise<{ url: string; id: string }> => {
    try {
      const uploadData = await uploadImage(file);
      return {
        id: uploadData.id,
        url: uploadData.url,
      };
    } catch (err) {
      console.error("Message image upload failed:", err);
      toast.error("이미지 업로드에 실패했습니다");
      throw err;
    }
  };

  const _removeAttachment = (imageId: string) => {
    setAttachmentIds((prev) => prev.filter((id) => id !== imageId));
    setAttachmentPreviews((prev) => {
      const preview = prev.find((p) => p.id === imageId);
      if (preview) {
        URL.revokeObjectURL(preview.url);
      }
      return prev.filter((p) => p.id !== imageId);
    });
  };

  const applyMutation = useMutation({
    mutationFn: async ({
      communityId,
      message,
      profileName,
      profileUsername,
      attachmentIds,
    }: {
      communityId: string;
      message?: string;
      profileName: string;
      profileUsername: string;
      attachmentIds?: string[];
    }) => {
      const res = await api.console.communities[":id"].apply.$post({
        param: { id: communityId },
        json: {
          message: message || null,
          profile_name: profileName,
          profile_username: profileUsername,
          attachment_ids: attachmentIds,
        },
      });
      if (!res.ok) {
        const errorData = await res.json();
        toast.error(getErrorMessage(errorData, "지원에 실패했습니다"));
      }
      return await res.json();
    },
    onSuccess: () => {
      toast.success("지원이 완료되었습니다!");
      queryClient.invalidateQueries({
        queryKey: ["community", slug],
      });
      queryClient.invalidateQueries({
        queryKey: ["my-applications", slug],
      });
      setMessage("");
      setProfileName("");
      setProfileUsername("");
      setAttachmentIds([]);
      // Cleanup preview URLs
      attachmentPreviews.forEach((preview) => {
        URL.revokeObjectURL(preview.url);
      });
      setAttachmentPreviews([]);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!community || !profileName.trim() || !profileUsername.trim()) return;
    applyMutation.mutate({
      communityId: community.slug,
      message,
      profileName: profileName.trim(),
      profileUsername: profileUsername.trim(),
      attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <div className="flex items-center justify-center min-h-64">
          <div className="flex items-center gap-3">
            <Spinner className="h-6 w-6" />
            <span className="text-muted-foreground">
              커뮤 정보를 불러오는 중...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !community) {
    // Show 404 page for not found errors
    if (errorStatus === 404) {
      return (
        <div className="container mx-auto py-8 px-4 max-w-2xl">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <CardTitle>커뮤를 찾을 수 없습니다</CardTitle>
              <CardDescription>
                존재하지 않거나 삭제된 커뮤입니다
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-2">
              <Link to="/communities">
                <Button className="w-full">커뮤 둘러보기</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Show generic error page for other errors
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">오류 발생</CardTitle>
            <CardDescription>커뮤 정보를 불러올 수 없습니다</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Button onClick={() => refetch()}>다시 시도</Button>
            <Link to="/communities">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                다른 커뮤 찾아보기
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Extract application form into a separate function
  const renderApplicationForm = () => {
    return (
      <Card>
        <CardHeader>
          <CardTitle>가입 신청서</CardTitle>
          <CardDescription>
            {community.name}에 가입을 신청합니다. 운영자가 검토한 후 승인 여부를
            알려드립니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor={profileNameId}>프로필 이름</Label>
              <Input
                id={profileNameId}
                placeholder="커뮤에서 사용할 이름을 입력하세요"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                required
                disabled={applyMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                커뮤 내에서 표시될 이름입니다
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor={profileUsernameId}>프로필 ID *</Label>
              <Input
                id={profileUsernameId}
                placeholder="@username (영문, 숫자, 언더스코어만 사용 가능)"
                value={profileUsername}
                onChange={(e) =>
                  setProfileUsername(
                    e.target.value
                      .replace(/\s/g, "_")
                      .replace(/[^a-zA-Z0-9_]/g, "")
                      .toLowerCase(),
                  )
                }
                required
                disabled={applyMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                @{profileUsername || "username"} 형태로 표시됩니다
              </p>
            </div>

            <div className="space-y-2">
              <Label>신청 메시지 (선택사항)</Label>
              <MarkdownEditor
                value={message}
                onChange={setMessage}
                placeholder="가입하고 싶은 이유나 자기소개를 작성해주세요..."
                disabled={applyMutation.isPending}
                onImageUpload={handleMessageImageUpload}
              />
              <p className="text-xs text-muted-foreground">
                운영자에게 전달될 메시지입니다. 텍스트에 이미지를 직접 삽입할 수
                있습니다.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={
                applyMutation.isPending ||
                !profileName.trim() ||
                !profileUsername.trim() ||
                isUploadingImage
              }
            >
              {applyMutation.isPending && <Spinner />}
              {applyMutation.isPending ? "신청 중..." : "가입 신청하기"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  };

  // Show different states based on user status
  const renderContent = () => {
    // Check if auth is still loading
    if (authLoading) {
      return (
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-3">
              <Spinner className="h-6 w-6" />
              <span className="text-muted-foreground">인증 확인 중...</span>
            </div>
          </CardContent>
        </Card>
      );
    }

    // User is already a member
    if (community.membership_status === "member") {
      return (
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-mint/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-mint-ink" />
            </div>
            <CardTitle className="text-mint-ink">
              이미 가입된 커뮤입니다
            </CardTitle>
            <CardDescription>
              {community.name}의{" "}
              {community.user_role === "owner" ? "운영자" : "멤버"}입니다
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link to="/communities/mine">
              <Button variant="outline" className="w-full">
                내 커뮤 목록 보기
              </Button>
            </Link>
          </CardContent>
        </Card>
      );
    }

    // Check if user has a pending application
    const hasPendingApplication = myApplications.some(
      (app) => app.status === "pending",
    );

    // If user has any applications, show them as a list
    if (myApplications.length > 0 && user) {
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>내 지원 내역</CardTitle>
              <CardDescription>
                이 커뮤에 제출한 지원서 목록입니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {myApplications.map((app) => (
                  <Link
                    key={app.id}
                    to={`/communities/${slug}/applications/${app.id}`}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            app.status === "approved"
                              ? "bg-mint/40 text-mint-ink"
                              : app.status === "pending"
                                ? "bg-butter/40 text-butter-ink"
                                : "bg-destructive/15 text-destructive"
                          }
                        >
                          {app.status === "approved"
                            ? "승인됨"
                            : app.status === "pending"
                              ? "대기중"
                              : "거절됨"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(app.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-1">
                        {app.profile_name} (@{app.profile_username})
                      </p>
                      {app.rejection_reason && (
                        <p className="text-xs text-destructive mt-1">
                          거절 사유: {app.rejection_reason}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Show re-apply section only if no pending application */}
          {!hasPendingApplication && (
            <>
              <Card>
                <CardHeader className="text-center">
                  <CardTitle>다시 지원하기</CardTitle>
                  <CardDescription>
                    새로운 지원서를 작성하여 다시 지원할 수 있습니다
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    onClick={() => {
                      // Scroll to the form below
                      window.scrollTo({
                        top: document.body.scrollHeight,
                        behavior: "smooth",
                      });
                    }}
                  >
                    지원서 작성하기
                  </Button>
                </CardContent>
              </Card>

              {/* Show the application form */}
              {renderApplicationForm()}
            </>
          )}
        </div>
      );
    }

    // User is not authenticated
    if (!user) {
      return (
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/15 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogIn className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>로그인이 필요합니다</CardTitle>
            <CardDescription>
              {community.name}에 지원하려면 먼저 로그인해주세요
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Link to="/login">
              <Button className="w-full">
                <LogIn className="h-4 w-4 mr-2" />
                로그인
              </Button>
            </Link>
            <Link to="/signup">
              <Button variant="outline" className="w-full">
                계정 만들기
              </Button>
            </Link>
          </CardContent>
        </Card>
      );
    }

    // Show application form
    return renderApplicationForm();
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="space-y-8">
        <div className="mb-2">
          <Link to="/communities">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              뒤로
            </Button>
          </Link>
        </div>

        <PageHeader
          eyebrow="지원하기"
          icon={Sparkles}
          title="커뮤에 참여해요"
          description={`${community.name} (@${community.slug})`}
          tone="mint"
        />

        {/* Banner Image */}
        {community.banner_image_url && (
          <div className="relative w-full rounded-xl overflow-hidden bg-muted">
            <div
              className="w-full flex items-center justify-center"
              style={{
                aspectRatio:
                  community.banner_image_width && community.banner_image_height
                    ? `${community.banner_image_width} / ${community.banner_image_height}`
                    : "16 / 9",
              }}
            >
              <img
                src={community.banner_image_url}
                alt={`${community.name} 배너`}
                width={community.banner_image_width ?? undefined}
                height={community.banner_image_height ?? undefined}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}

        {/* Hashtags */}
        {community.hashtags && community.hashtags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {community.hashtags.map((hashtag) => (
              <Badge key={hashtag.id} variant="outline">
                <Hash className="h-3 w-3 mr-1" />
                {hashtag.tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Content based on user status */}
        {renderContent()}
      </div>
    </div>
  );
}
