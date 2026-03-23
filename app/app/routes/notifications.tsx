import { useInfiniteQuery } from "@tanstack/react-query";
import {
  AtSign,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  MessageCircle,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { LoginButton } from "~/components/LoginButton";
import { LoadingState } from "~/components/shared/LoadingState";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Spinner } from "~/components/ui/spinner";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "~/components/ui/empty";
import { useUnreadCount } from "~/contexts/UnreadCountContext";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { client } from "~/lib/api-client";
import { createMarkdownInstance } from "~/lib/markdown-utils";
import type { Route } from "./+types/notifications";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "알림" },
    { name: "description", content: "새로운 알림 확인하기" },
  ];
}

interface Notification {
  id: string;
  type: string;
  content: string;
  read_at: string | null;
  created_at: string;
  sender: {
    id: string;
    name: string;
    username: string;
    profile_picture_url: string | null;
  } | null;
  related_post: {
    id: string;
    content: string;
    author: {
      id: string;
      name: string;
      username: string;
      profile_picture_url: string | null;
    };
  } | null;
  directMessage?: {
    id: string;
    content: string;
  } | null;
}

export default function Notifications() {
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const { isAuthenticated, currentProfile, isLoading: authLoading } = useAuth();
  const { refreshUnreadCounts } = useUnreadCount();
  const { instanceSlug } = useCurrentInstance();
  const NOTIFICATIONS_PER_PAGE = 20;

  // Create markdown instance for rendering notification content
  // Assume all mentions are valid (no API calls) for read-only content
  const md = useMemo(() => {
    return createMarkdownInstance(new Map());
  }, []);

  // Fetch notifications with infinite query
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["notifications", currentProfile?.id],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (!currentProfile?.id) {
        return { data: [], nextCursor: null, hasMore: false };
      }

      const response = await client.app.notifications.$get({
        query: {
          profile_id: currentProfile.id,
          limit: NOTIFICATIONS_PER_PAGE.toString(),
          ...(pageParam && { cursor: pageParam }),
        },
      });

      if (!response.ok) {
        throw new Error("알림을 불러올 수 없습니다");
      }

      const result = await response.json();
      return result;
    },
    getNextPageParam: (lastPage) => {
      if ("pagination" in lastPage) {
        return lastPage.pagination.has_more
          ? lastPage.pagination.next_cursor
          : undefined;
      }
      return undefined;
    },
    initialPageParam: undefined as string | undefined,
    enabled: isAuthenticated && !!instanceSlug && !!currentProfile,
  });

  const notifications =
    data?.pages.flatMap((page: { data: Notification[] }) => page.data) ?? [];

  const markAllAsRead = async () => {
    if (!currentProfile) return;

    try {
      setIsMarkingAllRead(true);
      const response = await client.app.notifications["mark-all-read"].$post({
        query: { profile_id: currentProfile.id },
      });

      if (response.ok) {
        // Refetch notifications to update read status
        refetch();
        // Refresh unread counts immediately
        refreshUnreadCounts();
      }
    } catch (err) {
      console.error("Failed to mark all as readAt:", err);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  // Infinite scroll trigger
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Scroll event listener for infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop =
        document.documentElement.scrollTop || document.body.scrollTop;
      const scrollHeight =
        document.documentElement.scrollHeight || document.body.scrollHeight;
      const clientHeight =
        document.documentElement.clientHeight || window.innerHeight;

      // Load more when within 200px of the bottom
      if (scrollHeight - scrollTop - clientHeight < 200) {
        loadMore();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadMore]);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    if (!isAuthenticated || !instanceSlug || !currentProfile) return;

    const interval = setInterval(() => {
      // Refetch notifications to get new ones
      refetch();
      // Refresh unread counts
      refreshUnreadCounts();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [
    isAuthenticated,
    instanceSlug,
    currentProfile,
    refreshUnreadCounts,
    refetch,
  ]);

  const markAsRead = async (notificationId: string) => {
    if (!currentProfile) return;

    try {
      const response = await client.app.notifications[
        ":notification_id"
      ].read.$post({
        param: { notification_id: notificationId },
        query: { profile_id: currentProfile.id },
      });

      if (response.ok) {
        // Refetch notifications to update read status
        refetch();
        // Refresh unread counts immediately
        refreshUnreadCounts();
      }
    } catch (err) {
      console.error("Failed to mark notification as readAt:", err);
    }
  };

  const markAsUnread = async (notificationId: string) => {
    if (!currentProfile) return;

    try {
      const response = await client.app.notifications[
        ":notification_id"
      ].unread.$post({
        param: { notification_id: notificationId },
        query: { profile_id: currentProfile.id },
      });

      if (response.ok) {
        // Refetch notifications to update read status
        refetch();
        // Refresh unread counts immediately
        refreshUnreadCounts();
      }
    } catch (err) {
      console.error("Failed to mark notification as unread:", err);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "reply":
        return <MessageCircle className="h-5 w-5 text-blue-600" />;
      case "mention":
        return <AtSign className="h-5 w-5 text-green-600" />;
      case "message":
        return <MessageCircle className="h-5 w-5 text-purple-600" />;
      default:
        return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getNotificationLink = (notification: Notification) => {
    if (notification.related_post) {
      // For post notifications (replies, mentions), link to the post
      return `/@${notification.related_post.author.username}/${notification.related_post.id}`;
    } else if (notification.directMessage && notification.sender) {
      // For message notifications, link to the conversation
      return `/messages/${notification.sender.username}`;
    }
    return null;
  };

  const formatTime = (createdAt: string) => {
    const date = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString("ko-KR");
  };

  if (authLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-card rounded-2xl shadow-sm border border-border p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Bell className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">
              로그인이 필요합니다
            </h1>
            <p className="text-muted-foreground mb-6">
              알림을 확인하려면 로그인해주세요.
            </p>
            <LoginButton />
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-64">
            <div className="flex items-center gap-3">
              <Spinner className="h-6 w-6" />
              <span className="text-muted-foreground">
                알림을 불러오는 중...
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-4">
        <div className="max-w-2xl mx-auto">
          {isError && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                <Bell className="h-4 w-4" />
                <span className="text-sm font-medium">
                  알림을 불러오는 중 오류가 발생했습니다
                </span>
              </div>
            </div>
          )}

          {/* Mark All as Read Button */}
          {notifications.length > 0 &&
            notifications.some((n) => n.read_at === null) && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={markAllAsRead}
                  disabled={isMarkingAllRead}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <CheckCheck className="h-3 w-3" />
                  {isMarkingAllRead ? "처리 중..." : "모든 알림 읽음 처리"}
                </button>
              </div>
            )}

          {notifications.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BellOff />
                </EmptyMedia>
                <EmptyTitle>새로운 알림이 없습니다</EmptyTitle>
                <EmptyDescription>
                  새로운 답글이나 멘션이 있으면 여기에 표시됩니다.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => {
                const notificationLink = getNotificationLink(notification);

                const cardContent = (
                  <Card
                    className={`transition-all hover:shadow-lg ${
                      notification.read_at === null
                        ? "bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700"
                        : ""
                    }`}
                  >
                    <CardHeader>
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <h3 className="font-semibold text-foreground text-sm leading-tight">
                                  {notification.content}
                                </h3>
                                <div
                                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                    notification.read_at !== null
                                      ? "bg-gray-300 dark:bg-gray-600"
                                      : "bg-blue-500 dark:bg-blue-400"
                                  }`}
                                />
                              </div>
                              {notification.sender && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span className="font-medium">
                                    {notification.sender.name}
                                  </span>
                                  {notification.sender.username && (
                                    <span className="text-gray-400">
                                      @{notification.sender.username}
                                    </span>
                                  )}
                                  <span>•</span>
                                  <span>
                                    {formatTime(notification.created_at)}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-start gap-1 flex-shrink-0">
                              {notification.read_at === null ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    markAsRead(notification.id);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-md border border-transparent hover:border-blue-200 transition-all"
                                  title="읽음으로 표시"
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    markAsUnread(notification.id);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md border border-transparent hover:border-border transition-all"
                                  title="읽지 않음으로 표시"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    {(notification.related_post ||
                      notification.directMessage) && (
                      <CardContent>
                        {notification.related_post && (
                          <div className="bg-background border border-border rounded-md p-2 text-sm text-foreground">
                            <div
                              className="prose prose-sm dark:prose-invert max-w-none line-clamp-3"
                              // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized markdown
                              dangerouslySetInnerHTML={{
                                __html: md.render(
                                  notification.related_post.content,
                                ),
                              }}
                            />
                          </div>
                        )}
                        {notification.directMessage && (
                          <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-md p-2 text-sm text-foreground">
                            <div
                              className="prose prose-sm dark:prose-invert max-w-none line-clamp-3"
                              // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized markdown
                              dangerouslySetInnerHTML={{
                                __html: md.render(
                                  notification.directMessage.content,
                                ),
                              }}
                            />
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );

                return (
                  <div key={notification.id}>
                    {notificationLink ? (
                      <Link
                        to={notificationLink}
                        className="block"
                        onClick={() => {
                          if (notification.read_at === null) {
                            markAsRead(notification.id);
                          }
                        }}
                      >
                        {cardContent}
                      </Link>
                    ) : (
                      cardContent
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Loading indicator for infinite scroll */}
          {isFetchingNextPage && (
            <div className="mt-6">
              <LoadingState message="더 많은 알림을 불러오는 중..." />
            </div>
          )}

          {/* End of content indicator */}
          {!hasNextPage && notifications.length > 0 && (
            <div className="bg-background rounded-2xl border border-border p-6 text-center mt-6">
              <p className="text-muted-foreground text-sm">
                모든 알림을 확인했습니다
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
