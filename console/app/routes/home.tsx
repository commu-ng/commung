import { useQueries, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Bot,
  ExternalLink,
  ImageIcon,
  MessageSquare,
  Plus,
  Rocket,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { useAuth } from "~/hooks/useAuth";
import { api } from "~/lib/api-client";
import { env } from "~/lib/env";
import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "커뮹 - 타임라인 기반 커뮤 플랫폼" },
    {
      name: "description",
      content: "타임라인 기반 커뮤 플랫폼",
    },
  ];
}

interface Community {
  id: string;
  name: string;
  slug: string;
  starts_at: string;
  ends_at: string;
  role: string;
  banner_image_url?: string | null;
  custom_domain?: string | null;
  domain_verified?: string | null;
  pending_application_count?: number;
}

interface BoardPost {
  id: string;
  board: {
    id: string;
    name: string;
    slug: string;
  };
  title: string;
  content: string;
  image: {
    id: string;
    url: string;
    width: number;
    height: number;
    filename: string;
  } | null;
  hashtags: {
    id: string;
    tag: string;
  }[];
  author: {
    id: string;
    login_name: string;
  };
  created_at: string;
  updated_at: string;
}

interface Board {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

async function fetchMyCommunities(): Promise<Community[]> {
  const res = await api.console.communities.mine.$get();
  if (!res.ok) {
    throw new Error("Failed to fetch communities");
  }
  const json = await res.json();
  return json.data;
}

async function fetchBoards(): Promise<Board[]> {
  const res = await api.console.boards.$get();
  if (!res.ok) {
    throw new Error("Failed to fetch boards");
  }
  const json = await res.json();
  return json.data;
}

async function fetchBoardPosts(boardSlug: string): Promise<BoardPost[]> {
  const res = await api.console.board[":board_slug"].posts.$get({
    param: { board_slug: boardSlug },
    query: { limit: "5" },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch board posts");
  }
  const json = await res.json();
  return json.data;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-48" />
      <Skeleton className="h-32" />
      <Skeleton className="h-64" />
    </div>
  );
}

function PendingApplications({ communities }: { communities: Community[] }) {
  const communitiesWithPending = communities.filter(
    (c) => c.pending_application_count && c.pending_application_count > 0,
  );

  if (communitiesWithPending.length === 0) {
    return null;
  }

  const totalPending = communitiesWithPending.reduce(
    (sum, c) => sum + (c.pending_application_count || 0),
    0,
  );

  return (
    <Card className="border-[var(--butter)]/60 bg-[var(--butter)]/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">
              대기 중인 지원서 {totalPending}건
            </CardTitle>
            <CardDescription>검토가 필요한 지원서가 있습니다</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {communitiesWithPending.map((community) => (
            <Link
              key={community.id}
              to={`/communities/${community.slug}/applications`}
              className="flex items-center justify-between p-3 rounded-lg border border-[var(--butter)]/60 bg-card hover:bg-[var(--butter)]/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                  {community.banner_image_url ? (
                    <img
                      src={community.banner_image_url}
                      alt={community.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Users className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <span className="font-medium">{community.name}</span>
              </div>
              <span className="text-sm font-medium text-butter-ink">
                {community.pending_application_count}건
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MyCommunities({ communities }: { communities: Community[] }) {
  const now = new Date();
  const activeCommunities = communities
    .filter((c) => new Date(c.ends_at) >= now)
    .slice(0, 5);

  if (activeCommunities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />내 커뮤
          </CardTitle>
          <CardDescription>참여 중인 커뮤가 없습니다</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/communities/create">
                <Plus className="h-4 w-4 mr-2" />
                커뮤 개설하기
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/communities">
                <Search className="h-4 w-4 mr-2" />
                커뮤 둘러보기
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />내 커뮤
            </CardTitle>
            <CardDescription>최근 활동 중인 커뮤</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/communities/mine">
              전체 보기
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {activeCommunities.map((community) => {
            const communityHost =
              community.custom_domain && community.domain_verified
                ? community.custom_domain
                : `${community.slug}.${env.domain}`;
            return (
              <a
                key={community.id}
                href={`https://${communityHost}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
              >
                <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                  {community.banner_image_url ? (
                    <img
                      src={community.banner_image_url}
                      alt={community.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Users className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{community.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {community.role === "owner"
                      ? "운영자"
                      : community.role === "moderator"
                        ? "모더레이터"
                        : "멤버"}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function LatestBoardPosts() {
  const { data: boards, isLoading: boardsLoading } = useQuery({
    queryKey: ["boards"],
    queryFn: fetchBoards,
  });

  const postQueries = useQueries({
    queries: (boards ?? []).map((board) => ({
      queryKey: ["board-posts-home", board.slug],
      queryFn: () => fetchBoardPosts(board.slug),
      enabled: !!boards,
    })),
  });

  const isLoading = boardsLoading || postQueries.some((q) => q.isLoading);

  if (isLoading) {
    return <Skeleton className="h-48" />;
  }

  if (!boards || boards.length === 0) {
    return null;
  }

  const boardsWithPosts = boards
    .map((board, i) => ({
      board,
      posts: postQueries[i]?.data ?? [],
    }))
    .filter((entry) => entry.posts.length > 0);

  if (boardsWithPosts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {boardsWithPosts.map(({ board, posts }) => (
        <Card key={board.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  {board.name}
                </CardTitle>
                {board.description && (
                  <CardDescription>{board.description}</CardDescription>
                )}
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/boards/${board.slug}`}>
                  전체 보기
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  to={`/boards/${board.slug}/posts/${post.id}`}
                  className="flex gap-2 p-2 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-shrink-0">
                    {post.image ? (
                      <img
                        src={post.image.url}
                        alt=""
                        className="rounded object-cover"
                        style={{ width: "48px", height: "48px" }}
                      />
                    ) : (
                      <div
                        className="rounded bg-muted flex items-center justify-center"
                        style={{ width: "48px", height: "48px" }}
                      >
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{post.title}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">
                        {post.author.login_name}
                      </span>
                      <span className="mx-1">·</span>
                      <span>
                        {new Date(post.created_at).toLocaleDateString("ko-KR", {
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </p>
                    {post.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {post.hashtags.map((hashtag) => (
                          <Badge
                            key={hashtag.id}
                            variant="outline"
                            className="text-xs h-4 px-1 py-0"
                          >
                            #{hashtag.tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function GettingStarted({ hasCommunities }: { hasCommunities: boolean }) {
  const steps = hasCommunities
    ? [
        {
          title: "커뮤 설정하기",
          description: "배너 이미지, 설명, 링크 등을 설정하세요",
          link: "/communities/mine",
          linkText: "내 커뮤 관리",
        },
      ]
    : [
        {
          title: "커뮤 개설하기",
          description: "나만의 커뮤를 만들어보세요",
          link: "/communities/create",
          linkText: "커뮤 개설",
        },
        {
          title: "커뮤 둘러보기",
          description: "다양한 커뮤를 탐색하고 참여하세요",
          link: "/communities",
          linkText: "커뮤 목록",
        },
      ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          시작하기
        </CardTitle>
        <CardDescription>
          {hasCommunities
            ? "커뮤를 더욱 활성화해보세요"
            : "커뮹과 함께 시작해보세요"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {steps.map((step) => (
            <div
              key={step.link}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div>
                <p className="font-medium">{step.title}</p>
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
              <Link
                to={step.link}
                className="text-sm text-primary hover:underline"
              >
                {step.linkText}
              </Link>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DeveloperResources() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          개발자 리소스
        </CardTitle>
        <CardDescription>봇 API를 활용해 커뮤를 자동화하세요</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <a
            href={`${env.apiBaseUrl}/bot/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">봇 API 문서</p>
                <p className="text-sm text-muted-foreground">
                  포스트 조회 및 작성 API
                </p>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

function PlatformNews() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          소식
        </CardTitle>
        <CardDescription>커뮹의 최신 소식을 확인하세요</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <a
            href="https://planet.moe/@commung"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            연합우주(플래닛)에서 소식 보기
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://x.com/commu_ng"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            X에서 소식 보기
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://discord.gg/eWq5ej9mgF"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            Discord 서버 참여하기
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://apps.apple.com/us/app/commung/id6755352136"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            App Store에서 앱 다운로드
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=ng.commu"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            Google Play에서 앱 다운로드
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

function AuthenticatedHome() {
  const {
    data: communities,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["communities", "mine"],
    queryFn: fetchMyCommunities,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">
            데이터를 불러오는데 실패했습니다
          </p>
        </CardContent>
      </Card>
    );
  }

  const communityList = communities || [];

  return (
    <div className="space-y-6">
      <MyCommunities communities={communityList} />
      <PendingApplications communities={communityList} />
      <LatestBoardPosts />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GettingStarted hasCommunities={communityList.length > 0} />
        <DeveloperResources />
      </div>
      <PlatformNews />
    </div>
  );
}

function UnauthenticatedHome() {
  return (
    <div className="space-y-8">
      <div className="text-center py-8">
        <h1 className="text-4xl font-bold mb-4">커뮹</h1>
        <p className="text-xl text-muted-foreground mb-6">
          타임라인 기반 커뮤 플랫폼
        </p>
        <div className="flex justify-center gap-4">
          <Button size="lg" asChild>
            <Link to="/login">로그인</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/signup">회원가입</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">간편한 커뮤 개설</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              복잡한 설정 없이 커뮤 전용 사이트가 자동으로 준비됩니다.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">커뮤별 프로필</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              사이트별 계정을 만들 필요 없이 커뮤별 프로필을 사용할 수 있습니다.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">커뮤 탐색</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              취향에 맞는 커뮤를 쉽게 찾고 참여할 수 있습니다.
            </p>
          </CardContent>
        </Card>
      </div>

      <LatestBoardPosts />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DeveloperResources />
        <PlatformNews />
      </div>
    </div>
  );
}

export default function Home() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {isAuthenticated ? <AuthenticatedHome /> : <UnauthenticatedHome />}
    </div>
  );
}
