import { useInfiniteQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ImageIcon,
  Loader2,
  MessageSquare,
  Pencil,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { LoadingState } from "~/components/shared/LoadingState";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { useAuth } from "~/hooks/useAuth";
import { api } from "~/lib/api-client";

interface BoardPostListProps {
  boardSlug: string;
  hashtags?: string[];
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
  reply_count: number;
  created_at: string;
  updated_at: string;
}

async function fetchBoardPosts(
  boardSlug: string,
  cursor?: string,
  hashtags?: string[],
) {
  const res = await api.console.board[":board_slug"].posts.$get({
    param: { board_slug: boardSlug },
    query: {
      limit: "20",
      ...(cursor ? { cursor } : {}),
      ...(hashtags && hashtags.length > 0
        ? { hashtags: hashtags.join(",") }
        : {}),
    },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch board posts");
  }
  return await res.json();
}

export function BoardPostList({ boardSlug, hashtags }: BoardPostListProps) {
  const { user, isAuthenticated } = useAuth();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["board-posts", boardSlug, hashtags],
    queryFn: ({ pageParam }) => fetchBoardPosts(boardSlug, pageParam, hashtags),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_more
        ? lastPage.pagination.next_cursor
        : undefined,
    initialPageParam: undefined as string | undefined,
  });

  // Intersection observer for infinite scrolling
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (isLoading) {
    return <LoadingState message="게시물을 불러오는 중..." />;
  }

  if (error) {
    return (
      <div className="py-8">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircle />
            </EmptyMedia>
            <EmptyTitle>오류 발생</EmptyTitle>
            <EmptyDescription>게시물을 불러올 수 없습니다</EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => refetch()}>다시 시도</Button>
        </Empty>
      </div>
    );
  }

  const posts = data?.pages.flatMap((page) => page.data) || [];

  if (posts.length === 0) {
    return (
      <div className="py-8">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquare />
            </EmptyMedia>
            <EmptyTitle>게시물이 없습니다</EmptyTitle>
            <EmptyDescription>첫 번째 게시물을 작성해보세요!</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {posts.map((post) => (
        <Card
          key={post.id}
          className="hover:bg-accent/50 transition-colors py-0"
        >
          <Link to={`/boards/${boardSlug}/posts/${post.id}`}>
            <CardHeader className="p-2">
              <div className="flex gap-2">
                <div className="flex-shrink-0">
                  {post.image ? (
                    <img
                      src={post.image.url}
                      alt=""
                      className="rounded object-cover"
                      style={{
                        width: "64px",
                        height: "64px",
                      }}
                    />
                  ) : (
                    <div
                      className="rounded bg-muted flex items-center justify-center"
                      style={{
                        width: "64px",
                        height: "64px",
                      }}
                    >
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <CardTitle className="text-sm truncate leading-tight">
                      {post.title}
                    </CardTitle>
                    {isAuthenticated && user?.id === post.author.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        onClick={(e) => e.stopPropagation()}
                        className="h-5 w-5 p-0 flex-shrink-0"
                      >
                        <Link to={`/boards/${boardSlug}/posts/${post.id}/edit`}>
                          <Pencil className="h-3 w-3" />
                        </Link>
                      </Button>
                    )}
                  </div>
                  <CardDescription className="text-xs mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium">
                      {post.author.login_name}
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(post.created_at).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}{" "}
                      {new Date(post.created_at).toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {post.reply_count > 0 && (
                      <>
                        <span>•</span>
                        <span className="inline-flex items-center gap-0.5">
                          <MessageSquare className="h-3 w-3" />
                          {post.reply_count}
                        </span>
                      </>
                    )}
                  </CardDescription>
                  <div className="flex flex-wrap gap-1 items-center mt-1.5">
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
                </div>
              </div>
            </CardHeader>
          </Link>
        </Card>
      ))}

      {/* Loading indicator and intersection observer target */}
      <div ref={loadMoreRef} className="flex justify-center py-4">
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">더 불러오는 중...</span>
          </div>
        )}
      </div>
    </div>
  );
}
