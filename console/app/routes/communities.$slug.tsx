import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle,
  ChevronDown,
  Clock,
  Coins,
  ExternalLink,
  FileText,
  Hash,
  LayoutGrid,
  LayoutList,
  LogOut,
  Settings,
  Users,
  XCircle,
} from "lucide-react";
import MarkdownIt from "markdown-it";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Skeleton } from "~/components/ui/skeleton";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";
import { api, getErrorMessage } from "~/lib/api-client";
import { env } from "~/lib/env";
import type { Route } from "./+types/communities.$slug";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "커뮤 상세 정보" },
    {
      name: "description",
      content: "커뮤의 상세 정보와 통계를 확인할 수 있습니다",
    },
  ];
}

const md = new MarkdownIt({ linkify: true, breaks: true });

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
  } | null;
  user_role: string | null;
  description?: string | null;
}

interface CommunityStats {
  community: {
    id: string;
    name: string;
    slug: string;
    banner_image_url: string | null;
    banner_image_width: number | null;
    banner_image_height: number | null;
    hashtags?: { id: string; tag: string }[];
  };
  applications: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  };
  members: {
    total: number;
  };
}

interface CommunityLink {
  id: string;
  title: string;
  url: string;
  created_at: string;
  updated_at: string;
}

interface Application {
  id: string;
  status: string;
  profile_name: string;
  profile_username: string;
  message: string | null;
  rejection_reason: string | null;
  created_at: string;
  attachments?: Array<{
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

// Fetch functions
async function fetchCommunity(slug: string): Promise<Community> {
  const response = await api.console.communities[":id"].$get({
    param: { id: slug },
  });
  if (!response.ok) {
    const error = new Error("커뮤 정보를 가져오는데 실패했습니다");
    (error as { status?: number }).status = response.status;
    throw error;
  }
  const result = await response.json();
  return result.data;
}

async function fetchLinks(slug: string): Promise<CommunityLink[]> {
  const response = await api.console.communities[":id"].links.$get({
    param: { id: slug },
  });
  if (!response.ok) {
    throw new Error("커뮤 링크를 가져오는데 실패했습니다");
  }
  const result = await response.json();
  return result.data;
}

async function fetchMyApplications(slug: string): Promise<Application[]> {
  const response = await api.console.communities[":id"]["my-applications"].$get(
    {
      param: { id: slug },
    },
  );
  if (!response.ok) {
    return [];
  }
  const result = await response.json();
  return result.data;
}

async function fetchStats(slug: string): Promise<CommunityStats> {
  const response = await api.console.communities[":id"].stats.$get({
    param: { id: slug },
  });
  if (!response.ok) {
    throw new Error("커뮤 통계를 가져오는데 실패했습니다");
  }
  const result = await response.json();
  return result.data;
}

export default function CommunityDetails() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser, isAuthenticated } = useAuth();
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // Fetch community and links in parallel
  const {
    data: community,
    isLoading: isCommunityLoading,
    error: communityError,
  } = useQuery({
    queryKey: ["community", slug],
    queryFn: () => fetchCommunity(slug ?? ""),
    enabled: !!slug,
  });

  const { data: links = [] } = useQuery({
    queryKey: ["community-links", slug],
    queryFn: () => fetchLinks(slug ?? ""),
    enabled: !!slug,
  });

  // Fetch applications if user is logged in
  const { data: applications = [] } = useQuery({
    queryKey: ["my-applications", slug],
    queryFn: () => fetchMyApplications(slug ?? ""),
    enabled: !!slug && isAuthenticated,
  });

  // Fetch stats if user is owner or moderator
  const userRole = community?.user_role as
    | "owner"
    | "moderator"
    | "member"
    | null;
  const { data: stats } = useQuery({
    queryKey: ["community-stats", slug],
    queryFn: () => fetchStats(slug ?? ""),
    enabled: !!slug && (userRole === "owner" || userRole === "moderator"),
  });

  const isLoading = isCommunityLoading;
  const error = communityError ? (communityError as Error).message : "";
  const errorStatus = communityError
    ? (communityError as { status?: number }).status
    : undefined;

  const leaveMutation = useMutation({
    mutationFn: async (communitySlug: string) => {
      const response = await api.console.communities[":id"].leave.$delete({
        param: { id: communitySlug },
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = getErrorMessage(
          errorData,
          "커뮤 나가기에 실패했습니다",
        );
        throw new Error(errorMessage);
      }
    },
    onSuccess: () => {
      toast.success("커뮤에서 나갔습니다");
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      navigate("/communities/mine");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSettled: () => {
      setShowLeaveDialog(false);
    },
  });

  const handleLeaveCommunity = () => {
    if (slug) {
      leaveMutation.mutate(slug);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-background min-h-screen p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-9 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
          <Skeleton className="h-64 w-full" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-lg p-6">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-2 pt-2">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !community) {
    // Show 404 page for not found errors
    if (errorStatus === 404) {
      return (
        <div className="bg-background min-h-screen p-6">
          <div className="max-w-2xl mx-auto">
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
                <Link to="/communities/mine">
                  <Button variant="outline" className="w-full">
                    내 커뮤로 돌아가기
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    // Show generic error page for other errors
    return (
      <div className="bg-background min-h-screen p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-destructive">오류 발생</CardTitle>
              <CardDescription>
                {error || "커뮤 정보를 불러올 수 없습니다"}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link to="/communities/mine">
                <Button>내 커뮤로 돌아가기</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {currentUser && (
              <Link to="/communities/mine">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />내 커뮤
                </Button>
              </Link>
            )}
            {currentUser && community?.membership_status === "member" && (
              <a
                href={`https://${community.slug}.${env.domain}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm">
                  <ArrowRight className="h-4 w-4 mr-2" />
                  입장
                </Button>
              </a>
            )}
          </div>
          <div className="flex gap-2">
            {currentUser && userRole === "owner" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4" />
                    관리
                    <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel>운영</DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link to={`/communities/${slug}/settings`}>
                      <Settings className="h-4 w-4" />
                      설정
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/communities/${slug}/members`}>
                      <Users className="h-4 w-4" />
                      멤버
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/communities/${slug}/analytics`}>
                      <BarChart3 className="h-4 w-4" />
                      분석
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>콘텐츠</DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link to={`/communities/${slug}/boards`}>
                      <LayoutList className="h-4 w-4" />
                      게시판
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>확장</DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link to={`/communities/${slug}/apps`}>
                      <LayoutGrid className="h-4 w-4" />앱
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/communities/${slug}/bots`}>
                      <Bot className="h-4 w-4" />봇
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/communities/${slug}/shop`}>
                      <Coins className="h-4 w-4" />
                      상점
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {currentUser && userRole === "moderator" && (
              <>
                <Link to={`/communities/${slug}/members`}>
                  <Button variant="outline" size="sm">
                    <Users className="h-4 w-4" />
                    멤버
                  </Button>
                </Link>
                <Link to={`/communities/${slug}/analytics`}>
                  <Button variant="outline" size="sm">
                    <BarChart3 className="h-4 w-4" />
                    분석
                  </Button>
                </Link>
              </>
            )}
            {currentUser &&
              userRole !== "owner" &&
              community?.membership_status === "member" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive/90"
                  onClick={() => setShowLeaveDialog(true)}
                >
                  <LogOut className="h-4 w-4" />
                  나가기
                </Button>
              )}
          </div>
        </div>

        {/* Community Banner Image */}
        {community.banner_image_url && (
          <div className="relative overflow-hidden rounded-lg bg-muted">
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
                alt={`${community.name} banner`}
                width={community.banner_image_width ?? undefined}
                height={community.banner_image_height ?? undefined}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent">
              <div className="p-6 text-white">
                <a
                  href={`https://${community.slug}.${env.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-2xl font-bold hover:text-white/80 transition-colors"
                >
                  {community.name}
                  <ExternalLink className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Community Title (when no banner) */}
        {!community.banner_image_url && (
          <div className="mb-6">
            <a
              href={`https://${community.slug}.${env.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 text-3xl font-bold text-foreground hover:text-muted-foreground transition-colors"
            >
              {community.name}
              <ExternalLink className="w-6 h-6" />
            </a>
          </div>
        )}

        {/* Community Hashtags */}
        {community.hashtags && community.hashtags.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>커뮤 해시태그</CardTitle>
              <CardDescription>
                이 커뮤를 설명하는 해시태그들입니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {community.hashtags.map((hashtag) => (
                  <Badge
                    key={hashtag.id}
                    variant="outline"
                    className="px-3 py-1.5 bg-primary/15 text-primary border-primary/30 text-sm"
                  >
                    <Hash className="h-3.5 w-3.5 mr-1.5" />
                    {hashtag.tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Application Section for Signed Out Users */}
        {!currentUser &&
          !community.membership_status &&
          community.is_recruiting && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  커뮤 가입 신청
                </CardTitle>
                <CardDescription>
                  이 커뮤는 현재 새로운 멤버를 모집하고 있습니다. 로그인 후
                  지원할 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to={`/login?next=/communities/${slug}`}>
                  <Button className="w-full">
                    <Users className="h-4 w-4 mr-2" />
                    로그인하고 지원하기
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

        {/* Application Section for Non-Members */}
        {currentUser &&
          !community.membership_status &&
          community.is_recruiting && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  커뮤 가입 신청
                </CardTitle>
                <CardDescription>
                  이 커뮤는 현재 새로운 멤버를 모집하고 있습니다
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to={`/communities/${community.slug}/apply`}>
                  <Button className="w-full">
                    <Users className="h-4 w-4 mr-2" />
                    {community.application_status
                      ? "지원 현황 보기"
                      : "가입 신청하기"}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

        {/* Applications Breakdown - Only for owners/moderators */}
        {(userRole === "owner" || userRole === "moderator") && stats && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>지원서 현황</CardTitle>
                  <CardDescription>
                    커뮤 가입 지원서의 상태별 통계
                  </CardDescription>
                </div>
                <Link to={`/communities/${slug}/applications`}>
                  <Button variant="outline">
                    <FileText className="h-4 w-4" />
                    지원서
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-butter-ink" />
                    <div>
                      <p className="font-medium">대기 중</p>
                      <p className="text-sm text-muted-foreground">검토 대기</p>
                    </div>
                  </div>
                  <Badge className="bg-butter/40 text-butter-ink">
                    {stats.applications.pending}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-mint-ink" />
                    <div>
                      <p className="font-medium">승인됨</p>
                      <p className="text-sm text-muted-foreground">가입 완료</p>
                    </div>
                  </div>
                  <Badge className="bg-mint/40 text-mint-ink">
                    {stats.applications.approved}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="font-medium">거절됨</p>
                      <p className="text-sm text-muted-foreground">가입 거절</p>
                    </div>
                  </div>
                  <Badge className="bg-destructive/15 text-destructive">
                    {stats.applications.rejected}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Community Links - Visible to all members */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>커뮤 링크</CardTitle>
                <CardDescription>커뮤에 등록된 유용한 링크들</CardDescription>
              </div>
              {userRole === "owner" && links.length > 0 && (
                <Link to={`/communities/${slug}/links`}>
                  <Button variant="outline" size="sm">
                    링크 관리하기
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {links.length === 0 ? (
              <div className="text-center py-8">
                <ExternalLink className="h-12 w-12 text-muted-foreground/60 mx-auto mb-3" />
                <h4 className="text-lg font-medium text-foreground mb-2">
                  등록된 링크가 없습니다
                </h4>
                {userRole === "owner" ? (
                  <>
                    <p className="text-muted-foreground mb-4">
                      커뮤 관리 페이지에서 링크를 추가해보세요
                    </p>
                    <Link to={`/communities/${slug}/links`}>
                      <Button>링크 관리하기</Button>
                    </Link>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    아직 등록된 링크가 없습니다
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {links.map((link) => (
                  <div
                    key={link.id}
                    className="flex min-w-0 items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-w-0 items-center gap-2 text-primary hover:text-primary/90 font-medium transition-colors"
                        >
                          <span className="truncate">{link.title}</span>
                          <ExternalLink className="h-4 w-4 flex-shrink-0" />
                        </a>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 break-all">
                        {link.url}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        생성일:{" "}
                        {new Date(link.created_at).toLocaleString("ko-KR")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Applications - Only for logged in users */}
        {currentUser && applications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>내 지원 내역</CardTitle>
              <CardDescription>
                이 커뮤에 제출한 지원서 내역입니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {applications.map((application) => (
                  <Link
                    key={application.id}
                    to={`/communities/${slug}/applications/${application.id}`}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            application.status === "pending"
                              ? "bg-butter/40 text-butter-ink"
                              : application.status === "approved"
                                ? "bg-mint/40 text-mint-ink"
                                : "bg-destructive/15 text-destructive"
                          }
                        >
                          {application.status === "pending"
                            ? "대기중"
                            : application.status === "approved"
                              ? "승인됨"
                              : "거절됨"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(application.created_at).toLocaleDateString(
                            "ko-KR",
                          )}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-1">
                        {application.profile_name} (@
                        {application.profile_username})
                      </p>
                      {application.rejection_reason && (
                        <p className="text-xs text-destructive mt-1">
                          거절 사유: {application.rejection_reason}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Community Description */}
        {community.description && (
          <Card>
            <CardHeader>
              <CardTitle>커뮤 소개</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown is sanitized by markdown-it
                dangerouslySetInnerHTML={{
                  __html: md.render(community.description),
                }}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Leave Community Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>커뮤 나가기</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 <strong>{community?.name}</strong> 커뮤에서 나가시겠습니까?
              다시 가입하려면 재신청이 필요합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaveMutation.isPending}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveCommunity}
              disabled={leaveMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {leaveMutation.isPending && <Spinner />}
              {leaveMutation.isPending ? "나가는 중..." : "나가기"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
