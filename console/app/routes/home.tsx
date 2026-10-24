import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Bookmark,
  Bot,
  Check,
  Clock,
  CircleHelp,
  ExternalLink,
  ImageIcon,
  LayoutGrid,
  MessageSquare,
  Search,
  Smile,
  Sparkles,
  Users,
} from "lucide-react";
import MarkdownIt from "markdown-it";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  COMMUNG_APP_URL,
  CommungOnNaruLanding,
  CommungOnNaruNotice,
} from "~/components/CommungOnNaru";
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
  reply_count: number;
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

async function fetchBoardsWithRecentPosts(): Promise<
  Array<{ board: Board; posts: BoardPost[] }>
> {
  const res = await api.console.boards["recent-posts"].$get();
  if (!res.ok) {
    throw new Error("Failed to fetch recent posts");
  }
  const json = await res.json();
  return json.data as unknown as Array<{ board: Board; posts: BoardPost[] }>;
}

interface CatalogShowcaseEntry {
  builtin_id: string;
  version: string;
  profile: { name: string; username: string };
  description: string;
  commands: Array<{ name: string }>;
}

async function fetchCatalogShowcase(): Promise<CatalogShowcaseEntry[]> {
  const res = await api.catalog.apps.$get();
  if (!res.ok) return [];
  const json = await res.json();
  return json.data as unknown as CatalogShowcaseEntry[];
}

interface NotificationItem {
  id: string;
  source: "profile" | "user";
  type: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
  sender: {
    name: string;
    profile_picture_url: string | null;
  } | null;
  link: string;
  group: {
    kind: "community" | "board";
    id: string;
    name: string;
    slug: string;
  };
}

interface RecentNotificationsResponse {
  data: NotificationItem[];
  total_unread: number;
}

async function fetchRecentNotifications(): Promise<RecentNotificationsResponse> {
  const res = await api.console.notifications.recent.$get();
  if (!res.ok) {
    throw new Error("Failed to fetch notifications");
  }
  return (await res.json()) as unknown as RecentNotificationsResponse;
}

async function markNotificationRead(args: {
  source: "profile" | "user";
  id: string;
}): Promise<void> {
  const res = await api.console.notifications[":source"][
    ":notification_id"
  ].read.$post({
    param: { source: args.source, notification_id: args.id },
  });
  if (!res.ok) {
    throw new Error("Failed to mark notification as read");
  }
}

const notificationMd = new MarkdownIt({ linkify: true, breaks: true });

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
  });
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

const SKELETON_DELAY_MS = 150;

/**
 * Returns true once `active` has been continuously true for `delayMs`.
 * Suppresses skeleton flashes when a query resolves quickly (cache hit
 * or fast network).
 */
function useDelayedFlag(active: boolean, delayMs = SKELETON_DELAY_MS) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const t = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(t);
  }, [active, delayMs]);
  return shown;
}

/**
 * Wraps a section's loading/loaded swap in a coordinated reveal:
 *   - the skeleton is mounted immediately so layout space is reserved,
 *     but stays at opacity 0 until SKELETON_DELAY_MS passes
 *   - if the query resolves before that, no skeleton ever flashes
 *   - when the data arrives, the content fades in cleanly
 *
 * IMPORTANT: `children` is evaluated eagerly by JSX even when the loader
 * picks the skeleton branch instead of rendering them. Inside children,
 * never dereference data that's `undefined` while loading — guard with
 * `data ?? []` or `?.` before calling `.map`/`.length`/etc.
 */
function SectionLoader({
  isLoading,
  skeleton,
  children,
}: {
  isLoading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
}) {
  const showSkeleton = useDelayedFlag(isLoading);
  if (isLoading) {
    return (
      <div
        className={`transition-opacity duration-200 ${
          showSkeleton ? "opacity-100" : "opacity-0"
        }`}
      >
        {skeleton}
      </div>
    );
  }
  return <div className="animate-in fade-in duration-300">{children}</div>;
}

const ENDING_SOON_DAYS = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysUntil(ends_at: string): number {
  const diff = new Date(ends_at).getTime() - Date.now();
  return Math.ceil(diff / MS_PER_DAY);
}

function isEndingSoon(community: Community): boolean {
  const days = daysUntil(community.ends_at);
  return days >= 0 && days <= ENDING_SOON_DAYS;
}

function WelcomeHero({
  userName,
  pendingCount,
  endingSoonCount,
}: {
  userName?: string;
  pendingCount: number;
  endingSoonCount: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card shadow-marsh px-6 sm:px-10 py-9">
      <div className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-gradient-to-br from-blossom/50 via-primary/20 to-transparent blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-gradient-to-tr from-mint/40 via-lilac/20 to-transparent blur-2xl" />
      <Sparkles className="pointer-events-none absolute top-6 right-8 h-6 w-6 text-primary/60" />

      <div className="relative">
        <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-primary mb-2">
          대시보드
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
          {userName ? `안녕하세요, ${userName}님` : "안녕하세요"}
        </h1>
        <p className="text-muted-foreground mt-3 max-w-lg leading-relaxed">
          참여 중인 커뮤와 새 알림을 한곳에서 확인하세요.
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-6">
          <Button asChild size="lg" className="rounded-full">
            <a href={COMMUNG_APP_URL} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              나루에서 커뮤 열기
            </a>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full">
            <Link to="/communities">
              <Search className="h-4 w-4" />
              둘러보기
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full">
            <Link to="/faq">
              <CircleHelp className="h-4 w-4" />
              자주 묻는 질문
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
          {endingSoonCount > 0 && (
            <Link
              to="/communities/mine"
              className="inline-flex items-center gap-2 rounded-full bg-blossom/40 text-blossom-ink px-4 py-2 text-sm font-semibold hover:bg-blossom/60 transition-colors"
            >
              <Clock className="h-3.5 w-3.5" />곧 종료 {endingSoonCount}개
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
  const active = communities.filter((c) => new Date(c.ends_at) >= now);
  const ended = communities.filter((c) => new Date(c.ends_at) < now);
  const ordered = [...active, ...ended];

  if (ordered.length === 0) {
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
            새 커뮤는 나루에 커뮹을 설치해서 열고, 원하는 대로 꾸밀 수 있어요.
          </p>
          <div className="flex justify-center gap-2">
            <Button asChild className="rounded-full">
              <a href={COMMUNG_APP_URL} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                나루에서 커뮤 열기
              </a>
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
        <CardTitle className="flex items-center gap-2">
          <Bookmark className="h-5 w-5 text-primary" strokeWidth={1.75} />
          <span>내 커뮤</span>
          {ended.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              ({active.length}개 활동 · {ended.length}개 종료)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ordered.map((community) => {
            const communityHost =
              community.custom_domain && community.domain_verified
                ? community.custom_domain
                : `${community.slug}.${env.domain}`;
            const hasEnded = new Date(community.ends_at) < now;
            return (
              <a
                key={community.id}
                href={`https://${communityHost}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex items-center gap-3 p-3 rounded-2xl border border-border/70 bg-card/60 hover:border-primary/30 hover:bg-accent/40 transition-all hover:-translate-y-0.5 hover:shadow-marsh ${
                  hasEnded ? "opacity-60 hover:opacity-100" : ""
                }`}
              >
                <div className="relative h-12 w-12 rounded-xl bg-gradient-to-br from-blossom/40 to-lilac/40 flex-shrink-0 overflow-hidden">
                  {community.banner_image_url ? (
                    <img
                      src={community.banner_image_url}
                      alt={community.name}
                      className={`h-full w-full object-cover ${hasEnded ? "grayscale" : ""}`}
                    />
                  ) : (
                    <Users className="h-full w-full p-3.5 text-foreground/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-sm truncate">
                      {community.name}
                    </p>
                    {hasEnded ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 px-1.5 py-0 bg-muted text-muted-foreground border-border flex-shrink-0"
                      >
                        종료
                      </Badge>
                    ) : (
                      isEndingSoon(community) && (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-4 px-1.5 py-0 bg-blossom/20 text-blossom-ink border-blossom/40 dark:bg-blossom/15 flex-shrink-0"
                        >
                          <Clock className="h-2.5 w-2.5" />
                          {daysUntil(community.ends_at)}일
                        </Badge>
                      )
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {community.role === "owner"
                      ? "운영자"
                      : community.role === "moderator"
                        ? "모더레이터"
                        : "멤버"}
                  </p>
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground/80 font-mono truncate mt-0.5">
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{communityHost}</span>
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

function NotificationsSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications-recent"],
    queryFn: fetchRecentNotifications,
  });

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["notifications-recent"] });
      const previous = queryClient.getQueryData<RecentNotificationsResponse>([
        "notifications-recent",
      ]);
      if (previous) {
        queryClient.setQueryData<RecentNotificationsResponse>(
          ["notifications-recent"],
          {
            data: previous.data.filter(
              (n) => !(n.id === vars.id && n.source === vars.source),
            ),
            total_unread: Math.max(0, previous.total_unread - 1),
          },
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications-recent"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-recent"] });
    },
  });

  const notifications = data?.data ?? [];
  if (isLoading) {
    return (
      <SectionLoader
        isLoading
        skeleton={<Skeleton className="h-48 rounded-3xl" />}
      >
        {null}
      </SectionLoader>
    );
  }
  if (notifications.length === 0) {
    return (
      <SectionLoader
        isLoading={false}
        skeleton={<Skeleton className="h-48 rounded-3xl" />}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-marsh">
                <Bell className="h-4 w-4" />
              </span>
              알림
            </CardTitle>
            <CardDescription className="ml-10">
              모든 커뮤의 새 알림을 한곳에서 확인해요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-mint/40 text-mint-ink shadow-marsh mb-3">
                <Check className="h-6 w-6" />
              </span>
              <p className="font-display text-base font-bold mb-1">
                새로운 알림이 없어요
              </p>
              <p className="text-xs text-muted-foreground">
                모두 확인했어요. 잠시 쉬어가요!
              </p>
            </div>
          </CardContent>
        </Card>
      </SectionLoader>
    );
  }

  // Group by group.kind + group.id, preserving order of first appearance
  // (which is sorted by created_at desc on the server).
  const groups: Array<{
    key: string;
    label: string;
    kind: "community" | "board";
    items: NotificationItem[];
  }> = [];
  const groupIndex = new Map<string, number>();
  for (const n of notifications) {
    const key = `${n.group.kind}:${n.group.id}`;
    let idx = groupIndex.get(key);
    if (idx === undefined) {
      idx = groups.length;
      groupIndex.set(key, idx);
      groups.push({
        key,
        label:
          n.group.kind === "board" ? `${n.group.name} 게시판` : n.group.name,
        kind: n.group.kind,
        items: [],
      });
    }
    groups[idx]?.items.push(n);
  }

  return (
    <SectionLoader
      isLoading={false}
      skeleton={<Skeleton className="h-48 rounded-3xl" />}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-marsh">
                  <Bell className="h-4 w-4" />
                </span>
                알림
                {data && data.total_unread > 0 && (
                  <Badge className="bg-primary/15 text-primary dark:bg-primary/25">
                    {data.total_unread}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="ml-10">
                모든 커뮤의 새 알림을 한곳에서 확인해요
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.key} className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground/80 ml-1">
                  {g.label}
                </p>
                <div className="space-y-2">
                  {g.items.map((n) => {
                    const isExternal = n.link.startsWith("http");
                    const linkClass =
                      "flex flex-1 min-w-0 gap-3 group/link rounded-l-2xl py-3 pl-3";
                    const linkBody = (
                      <>
                        <div className="flex-shrink-0">
                          {n.sender?.profile_picture_url ? (
                            <img
                              src={n.sender.profile_picture_url}
                              alt=""
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-mint/40 to-lilac/40 flex items-center justify-center">
                              <Bell className="h-4 w-4 text-foreground/40" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate group-hover/link:text-primary transition-colors">
                            {n.title}
                          </p>
                          <div
                            className="text-xs text-muted-foreground mt-0.5 prose prose-xs max-w-none [&_p]:my-0 [&_p]:leading-relaxed [&_a]:text-primary [&_a:hover]:underline line-clamp-3"
                            // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown is sanitized by markdown-it
                            dangerouslySetInnerHTML={{
                              __html: notificationMd.render(n.message),
                            }}
                          />
                          <p className="text-[11px] text-muted-foreground/80 mt-1">
                            {n.sender && (
                              <>
                                <span className="font-medium">
                                  {n.sender.name}
                                </span>
                                <span className="mx-1">·</span>
                              </>
                            )}
                            <span>{relativeTime(n.created_at)}</span>
                          </p>
                        </div>
                      </>
                    );
                    return (
                      <div
                        key={n.id}
                        className="flex items-stretch rounded-2xl border border-border/60 hover:border-primary/30 hover:bg-accent/40 transition-all"
                      >
                        {isExternal ? (
                          <a
                            href={n.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={linkClass}
                          >
                            {linkBody}
                          </a>
                        ) : (
                          <Link to={n.link} className={linkClass}>
                            {linkBody}
                          </Link>
                        )}
                        <button
                          type="button"
                          aria-label="읽음으로 표시"
                          title="읽음으로 표시"
                          onClick={() =>
                            markRead.mutate({ source: n.source, id: n.id })
                          }
                          disabled={markRead.isPending}
                          className="flex-shrink-0 px-3 my-3 ml-2 mr-3 rounded-full text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </SectionLoader>
  );
}

function LatestBoardPosts() {
  const { data, isLoading } = useQuery({
    queryKey: ["boards-recent-posts-home"],
    queryFn: fetchBoardsWithRecentPosts,
  });

  const boardsWithPosts = (data ?? []).filter(
    (entry) => entry.posts.length > 0,
  );

  if (!isLoading && boardsWithPosts.length === 0) {
    return null;
  }

  return (
    <SectionLoader
      isLoading={isLoading}
      skeleton={<Skeleton className="h-48 rounded-3xl" />}
    >
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
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <span className="font-medium">
                          {post.author.login_name}
                        </span>
                        <span>·</span>
                        <span>
                          {new Date(post.created_at).toLocaleDateString(
                            "ko-KR",
                            {
                              month: "long",
                              day: "numeric",
                            },
                          )}
                        </span>
                        {post.reply_count > 0 && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-0.5">
                              <MessageSquare className="h-3 w-3" />
                              {post.reply_count}
                            </span>
                          </>
                        )}
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
    </SectionLoader>
  );
}

function AppsShowcase() {
  const { data, isLoading } = useQuery({
    queryKey: ["catalog-apps-showcase"],
    queryFn: fetchCatalogShowcase,
  });

  if (!isLoading && (!data || data.length === 0)) {
    return null;
  }

  return (
    <SectionLoader
      isLoading={isLoading}
      skeleton={<Skeleton className="h-64 rounded-3xl" />}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-butter/40 text-butter-ink shadow-marsh">
                  <LayoutGrid className="h-4 w-4" />
                </span>
                앱 카탈로그
              </CardTitle>
              <CardDescription className="ml-10">
                슬래시 명령으로 커뮤를 더 재미있게 만들어보세요
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="rounded-full text-muted-foreground"
            >
              <Link to="/apps">
                전체 보기
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(data ?? []).map((app) => (
              <Link
                key={app.builtin_id}
                to={`/apps/${app.builtin_id}`}
                className="group flex flex-col gap-2 p-4 rounded-2xl border border-border/70 bg-card/60 hover:border-primary/30 hover:bg-accent/40 transition-all hover:-translate-y-0.5 hover:shadow-marsh"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{app.profile.name}</p>
                  <Badge variant="secondary" className="text-xs">
                    v{app.version}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {app.description}
                </p>
                {app.commands.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {app.commands.slice(0, 4).map((cmd) => (
                      <code
                        key={cmd.name}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground/80 font-mono"
                      >
                        /{cmd.name}
                      </code>
                    ))}
                    {app.commands.length > 4 && (
                      <span className="text-[10px] text-muted-foreground self-center">
                        +{app.commands.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </SectionLoader>
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

function MyCommunitiesSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["communities", "mine"],
    queryFn: fetchMyCommunities,
  });

  return (
    <SectionLoader
      isLoading={isLoading}
      skeleton={<Skeleton className="h-48 rounded-3xl" />}
    >
      {error ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">내 커뮤를 불러오지 못했어요</p>
          </CardContent>
        </Card>
      ) : (
        <MyCommunitiesGrid communities={data ?? []} />
      )}
    </SectionLoader>
  );
}

function WelcomeHeroLive({ userName }: { userName?: string }) {
  const { data } = useQuery({
    queryKey: ["communities", "mine"],
    queryFn: fetchMyCommunities,
  });
  const communities = data ?? [];
  const totalPending = communities
    .filter((c) => c.role === "owner" || c.role === "moderator")
    .reduce((sum, c) => sum + (c.pending_application_count || 0), 0);
  const endingSoonCount = communities.filter(
    (c) => (c.role === "owner" || c.role === "moderator") && isEndingSoon(c),
  ).length;

  return (
    <WelcomeHero
      userName={userName}
      pendingCount={totalPending}
      endingSoonCount={endingSoonCount}
    />
  );
}

function AuthenticatedHome() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <CommungOnNaruNotice />
      <WelcomeHeroLive userName={user?.login_name ?? undefined} />
      <NotificationsSection />
      <MyCommunitiesSection />
      <AppsShowcase />
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
      {isAuthenticated ? <AuthenticatedHome /> : <CommungOnNaruLanding />}
    </div>
  );
}
