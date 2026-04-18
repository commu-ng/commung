import { useQueries, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Bot,
  ExternalLink,
  Heart,
  ImageIcon,
  MessageSquare,
  Plus,
  Search,
  Smile,
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
  board: { id: string; name: string; slug: string };
  title: string;
  content: string;
  image: {
    id: string;
    url: string;
    width: number;
    height: number;
    filename: string;
  } | null;
  hashtags: { id: string; tag: string }[];
  author: { id: string; login_name: string };
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
      <Skeleton className="h-44 rounded-3xl" />
      <Skeleton className="h-32 rounded-3xl" />
      <Skeleton className="h-64 rounded-3xl" />
    </div>
  );
}

function WelcomeHero({
  userName,
  pendingCount,
}: {
  userName?: string;
  pendingCount: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card shadow-marsh px-6 sm:px-10 py-9">
      <div className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-gradient-to-br from-blossom/50 via-primary/20 to-transparent blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-gradient-to-tr from-mint/40 via-lilac/20 to-transparent blur-2xl" />
      <Sparkles className="pointer-events-none absolute top-6 right-8 h-6 w-6 text-primary/60" />
      <Heart
        className="pointer-events-none absolute bottom-8 right-16 h-5 w-5 text-blossom"
        fill="currentColor"
      />

      <div className="relative">
        <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-primary mb-2">
          오늘도 만나서 반가워요
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
          {userName ? `${userName}님, ` : ""}
          <span className="text-primary">소소한 커뮤</span>를
          <br className="hidden sm:block" /> 함께 가꿔봐요
        </h1>
        <p className="text-muted-foreground mt-3 max-w-lg leading-relaxed">
          모든 일상과 자캐, 취향을 나눌 작은 공간을 만들어보세요. 새 글, 새
          친구, 새 이야기가 기다리고 있어요.
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-6">
          <Button asChild size="lg" className="rounded-full">
            <Link to="/communities/create">
              <Plus className="h-4 w-4" />
              커뮤 만들기
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full">
            <Link to="/communities">
              <Search className="h-4 w-4" />
              둘러보기
            </Link>
          </Button>
          {pendingCount > 0 && (
            <Link
              to="/communities/mine"
              className="inline-flex items-center gap-2 rounded-full bg-butter/40 text-butter-ink px-4 py-2 text-sm font-semibold hover:bg-butter/60 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              검토 대기 {pendingCount}건
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function MyCommunitiesGrid({ communities }: { communities: Community[] }) {
  const now = new Date();
  const activeCommunities = communities
    .filter((c) => new Date(c.ends_at) >= now)
    .slice(0, 6);

  if (activeCommunities.length === 0) {
    return (
      <Card className="text-center">
        <CardContent className="py-10 px-6">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-mint/40 text-mint-ink mx-auto mb-4 shadow-marsh">
            <Smile className="h-7 w-7" />
          </span>
          <h3 className="font-display text-xl font-bold mb-1.5">
            첫 커뮤를 시작해볼까요?
          </h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
            취향을 나눌 사람들과 작은 공간을 꾸려보세요.
          </p>
          <div className="flex justify-center gap-2">
            <Button asChild className="rounded-full">
              <Link to="/communities/create">
                <Plus className="h-4 w-4" />
                커뮤 만들기
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/communities">
                <Search className="h-4 w-4" />
                둘러보기
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
          <CardTitle className="flex items-center gap-2">
            <Heart
              className="h-5 w-5 text-primary"
              fill="currentColor"
              strokeWidth={1.5}
            />
            내 커뮤
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="rounded-full text-muted-foreground"
          >
            <Link to="/communities/mine">
              전체 보기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                className="group flex items-center gap-3 p-3 rounded-2xl border border-border/70 bg-card/60 hover:border-primary/30 hover:bg-accent/40 transition-all hover:-translate-y-0.5 hover:shadow-marsh"
              >
                <div className="relative h-12 w-12 rounded-xl bg-gradient-to-br from-blossom/40 to-lilac/40 flex-shrink-0 overflow-hidden">
                  {community.banner_image_url ? (
                    <img
                      src={community.banner_image_url}
                      alt={community.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Users className="h-5 w-5 text-foreground/40 m-auto h-full w-full p-3.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {community.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {community.role === "owner"
                      ? "운영자"
                      : community.role === "moderator"
                        ? "모더레이터"
                        : "멤버"}
                  </p>
                </div>
                {community.pending_application_count !== undefined &&
                  community.pending_application_count > 0 && (
                    <Badge className="bg-butter/40 text-butter-ink dark:bg-butter/25">
                      {community.pending_application_count}
                    </Badge>
                  )}
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
    return <Skeleton className="h-48 rounded-3xl" />;
  }

  if (!boards || boards.length === 0) {
    return null;
  }

  const boardsWithPosts = boards
    .map((board, i) => ({ board, posts: postQueries[i]?.data ?? [] }))
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
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lilac/40 text-lilac-ink shadow-marsh">
                    <MessageSquare className="h-4 w-4" />
                  </span>
                  {board.name}
                </CardTitle>
                {board.description && (
                  <CardDescription className="ml-10">
                    {board.description}
                  </CardDescription>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="rounded-full text-muted-foreground"
              >
                <Link to={`/boards/${board.slug}`}>
                  전체 보기
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  to={`/boards/${board.slug}/posts/${post.id}`}
                  className="group flex gap-3 p-3 rounded-2xl border border-border/60 hover:bg-accent/40 hover:border-primary/30 transition-all"
                >
                  <div className="flex-shrink-0">
                    {post.image ? (
                      <img
                        src={post.image.url}
                        alt=""
                        className="h-14 w-14 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-mint/40 to-sky-soft/40 flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-foreground/40" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                      {post.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
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
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {post.hashtags.map((hashtag) => (
                          <Badge
                            key={hashtag.id}
                            variant="outline"
                            className="text-xs h-5 px-1.5 py-0"
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

function ResourcesAndNews() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-mint/40 text-mint-ink shadow-marsh">
              <Bot className="h-4 w-4" />
            </span>
            개발자 리소스
          </CardTitle>
          <CardDescription>봇 API로 커뮤를 자동화해요</CardDescription>
        </CardHeader>
        <CardContent>
          <a
            href={`${env.apiBaseUrl}/bot/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-2xl border border-border/70 hover:bg-accent/40 hover:border-primary/30 transition-all group"
          >
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <div>
                <p className="font-medium text-sm">봇 API 문서</p>
                <p className="text-xs text-muted-foreground">
                  포스트 조회 및 작성 API
                </p>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blossom/40 text-blossom-ink shadow-marsh">
              <Sparkles className="h-4 w-4" />
            </span>
            소식
          </CardTitle>
          <CardDescription>커뮹의 최신 소식을 확인해요</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-1.5">
            {[
              {
                href: "https://planet.moe/@commung",
                label: "연합우주(플래닛)",
              },
              { href: "https://x.com/commu_ng", label: "X" },
              { href: "https://discord.gg/eWq5ej9mgF", label: "Discord" },
              {
                href: "https://apps.apple.com/us/app/commung/id6755352136",
                label: "App Store",
              },
              {
                href: "https://play.google.com/store/apps/details?id=ng.commu",
                label: "Google Play",
              },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between rounded-full px-3.5 py-1.5 text-sm text-foreground/80 hover:bg-accent/60 hover:text-foreground transition-colors"
              >
                <span>{link.label}</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
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
  const { user } = useAuth();

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
  const totalPending = communityList
    .filter((c) => c.role === "owner" || c.role === "moderator")
    .reduce((sum, c) => sum + (c.pending_application_count || 0), 0);

  return (
    <div className="space-y-6">
      <WelcomeHero
        userName={user?.login_name ?? undefined}
        pendingCount={totalPending}
      />
      <MyCommunitiesGrid communities={communityList} />
      <LatestBoardPosts />
      <ResourcesAndNews />
    </div>
  );
}

function GuestHero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card shadow-marsh-lg px-6 sm:px-12 py-12 text-center">
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br from-blossom/50 via-primary/30 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-mint/40 via-lilac/30 to-transparent blur-3xl" />

      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-4 py-1.5 text-xs font-semibold tracking-wide">
          <Sparkles className="h-3 w-3" />
          타임라인 기반 커뮤 플랫폼
        </span>
        <h1 className="font-display text-4xl sm:text-6xl font-bold mt-5 leading-[1.1] tracking-tight">
          <span className="text-primary">커뮹</span>에서
          <br />
          작은 우리의 커뮤를 시작해요
          <Heart
            className="inline-block ml-2 h-7 w-7 sm:h-10 sm:w-10 text-blossom align-middle"
            fill="currentColor"
          />
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground mt-5 max-w-xl mx-auto leading-relaxed">
          취향을 나눌 사람들과 함께, 일상과 자캐와 이야기를 부드럽게 엮어가는
          공간이에요.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
          <Button asChild size="lg" className="rounded-full">
            <Link to="/signup">
              <Sparkles className="h-4 w-4" />
              지금 시작하기
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full">
            <Link to="/login">로그인</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: Sparkles,
    tone: "primary" as const,
    title: "간편한 커뮤 개설",
    body: "복잡한 설정 없이도 커뮤 전용 공간이 자동으로 준비돼요.",
  },
  {
    icon: Users,
    tone: "mint" as const,
    title: "커뮤별 프로필",
    body: "사이트마다 새 계정을 만들 필요 없이, 커뮤별 프로필로 부드럽게 오가요.",
  },
  {
    icon: Search,
    tone: "lilac" as const,
    title: "취향 탐색",
    body: "해시태그와 모집 상태로, 마음에 드는 커뮤를 쉽게 발견할 수 있어요.",
  },
];

function FeatureGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {FEATURES.map((f) => {
        const Icon = f.icon;
        const tonePalette = {
          primary: { bg: "bg-primary/15", ink: "text-primary" },
          mint: { bg: "bg-mint/40", ink: "text-mint-ink" },
          lilac: { bg: "bg-lilac/40", ink: "text-lilac-ink" },
        };
        const t = tonePalette[f.tone];
        return (
          <Card
            key={f.title}
            className="text-center hover:-translate-y-0.5 hover:shadow-marsh-lg transition-all duration-300"
          >
            <CardContent className="pt-6">
              <span
                className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${t.bg} ${t.ink} shadow-marsh mb-3`}
              >
                <Icon className="h-6 w-6" />
              </span>
              <h3 className="font-display text-lg font-bold mb-1.5">
                {f.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {f.body}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function UnauthenticatedHome() {
  return (
    <div className="space-y-8">
      <GuestHero />
      <FeatureGrid />
      <LatestBoardPosts />
      <ResourcesAndNews />
    </div>
  );
}

export default function Home() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {isAuthenticated ? <AuthenticatedHome /> : <UnauthenticatedHome />}
    </div>
  );
}
