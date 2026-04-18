import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, MessageCircle, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { PostCard } from "~/components/post-card";
import { ProfileAvatar } from "~/components/profile-avatar";
import { LoadingState } from "~/components/shared/LoadingState";
import { Spinner } from "~/components/ui/spinner";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "~/components/ui/empty";
import { useAuth } from "~/hooks/useAuth";
import { client } from "~/lib/api-client";
import { getGradientForUser } from "~/lib/gradient-utils";
import { getReadOnlyMarkdownInstance } from "~/lib/markdown-utils";
import type { Post } from "~/types/post";
import type { Profile } from "~/types/profile";

export default function ProfileProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user, currentProfile } = useAuth();

  const [isCommunityOwner, _setIsCommunityOwner] = useState(false);
  const POSTS_PER_PAGE = 20;
  const md = getReadOnlyMarkdownInstance();

  // Only allow usernames that start with @
  useEffect(() => {
    if (username && !username.startsWith("@")) {
      // Redirect to 404 or home for non-@ URLs
      navigate("/", { replace: true });
      return;
    }
  }, [username, navigate]);

  // Handle @ prefix and validate username format
  const actualUsername = username?.startsWith("@")
    ? username.slice(1)
    : undefined;

  // Fetch profile
  const {
    data: profile,
    isLoading: isProfileLoading,
    error: profileError,
  } = useQuery({
    queryKey: ["profile", actualUsername],
    queryFn: async (): Promise<Profile> => {
      if (!actualUsername) {
        throw new Error("Username is required");
      }

      const response = await client.app.profiles[":username"].$get({
        param: { username: actualUsername },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("사용자를 찾을 수 없습니다");
        }
        throw new Error("사용자 정보를 불러오는 데 실패했습니다");
      }

      const result = await response.json();
      return result.data;
    },
    enabled: !!actualUsername,
  });

  // Fetch posts with infinite query
  const {
    data: postsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isPostsLoading,
    isError: isPostsError,
  } = useInfiniteQuery({
    queryKey: ["profile-posts", actualUsername],
    queryFn: async ({ pageParam = 0 }): Promise<Post[]> => {
      if (!actualUsername) {
        return [];
      }

      const response = await client.app.profiles[":username"].posts.$get({
        param: { username: actualUsername },
        query: {
          limit: POSTS_PER_PAGE.toString(),
          cursor: pageParam ? pageParam.toString() : undefined,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch posts: ${response.status}`);
      }

      const result = await response.json();

      if (!result.data || !Array.isArray(result.data)) {
        throw new Error("예상치 못한 응답 형식");
      }

      return result.data;
    },
    getNextPageParam: (lastPage, allPages) => {
      const totalLoaded = allPages.reduce(
        (total, page) => total + page.length,
        0,
      );
      return lastPage.length < POSTS_PER_PAGE ? undefined : totalLoaded;
    },
    initialPageParam: 0,
    enabled: !!actualUsername,
  });

  const posts = postsData?.pages.flat() ?? [];

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

  if (isProfileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Spinner className="h-8 w-8 mx-auto mb-4" />
          <p className="text-muted-foreground">사용자 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            {profileError instanceof Error
              ? profileError.message
              : "사용자를 찾을 수 없습니다"}
          </h1>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-primary hover:text-primary/90 font-medium"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="p-2 rounded-full hover:bg-accent transition-colors"
              title="뒤로 가기"
            >
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </button>
            <div className="h-4 w-px bg-border"></div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {profile.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                @{profile.username}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Profile Card */}
          <div className="bg-card rounded-2xl shadow-marsh border border-border overflow-hidden">
            {/* Profile Header */}
            <div
              className={`bg-gradient-to-r ${getGradientForUser(
                profile.username,
                profile.name,
              )} px-6 py-8`}
            >
              <div className="flex items-center gap-4">
                <ProfileAvatar
                  profilePictureUrl={profile.profile_picture_url || undefined}
                  name={profile.name}
                  username={profile.username}
                  size="xl"
                  className="bg-white/20 backdrop-blur"
                />
                <div className="text-white">
                  <h2 className="text-2xl font-bold">{profile.name}</h2>
                  <p className="text-white/90 text-lg">@{profile.username}</p>
                  {profile.bio && (
                    <div
                      className="prose prose-sm dark:prose-invert text-white/95 mt-2 leading-relaxed max-w-md prose-headings:text-white prose-a:text-white/90 prose-a:hover:text-white prose-strong:text-white prose-code:text-white/90"
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized html
                      dangerouslySetInnerHTML={{
                        __html: md.render(profile.bio),
                      }}
                    />
                  )}
                  <div className="flex items-center gap-2 mt-3 text-white/90">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">
                      {new Date(profile.created_at).toLocaleDateString("ko-KR")}
                      에 가입
                    </span>
                  </div>
                  {user && profile.username !== user.login_name && (
                    <div className="mt-4">
                      <Link
                        to={`/messages/${profile.username}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-card text-primary rounded-lg hover:bg-primary/15 hover:text-primary transition-all duration-200 text-sm font-medium shadow-marsh"
                      >
                        <MessageCircle className="h-4 w-4" />
                        메시지 보내기
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Posts Stats */}
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MessageCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  게시물 {profile.post_count ?? 0}개
                </span>
              </div>
            </div>
          </div>

          {/* Posts Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">게시물</h3>

            {isPostsLoading ? (
              <div className="bg-card rounded-2xl shadow-sm border border-border p-8 text-center">
                <Spinner className="h-6 w-6 mx-auto mb-4" />
                <p className="text-muted-foreground">게시물을 불러오는 중...</p>
              </div>
            ) : isPostsError ? (
              <Empty className="bg-card rounded-2xl shadow-sm border border-border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MessageCircle />
                  </EmptyMedia>
                  <EmptyTitle>오류가 발생했습니다</EmptyTitle>
                  <EmptyDescription>
                    게시물을 불러오는 데 실패했습니다
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : posts.length === 0 ? (
              <Empty className="bg-card rounded-2xl shadow-sm border border-border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MessageCircle />
                  </EmptyMedia>
                  <EmptyTitle>아직 게시물이 없습니다</EmptyTitle>
                  <EmptyDescription>
                    {profile.name}님이 작성한 게시물이 없습니다.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                <div className="space-y-4">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={{
                        ...post,
                        replies: [],
                        in_reply_to_id: null,
                        depth: 0,
                        root_post_id: null,
                        content_warning: null,
                        is_bookmarked: false,
                      }}
                      currentProfileId={currentProfile?.id}
                      isCommunityOwner={isCommunityOwner}
                      isProfileView={true}
                    />
                  ))}
                </div>

                {/* Loading indicator for infinite scroll */}
                {isFetchingNextPage && (
                  <LoadingState message="더 많은 게시물을 불러오는 중..." />
                )}

                {/* End of content indicator */}
                {!hasNextPage && posts.length > 0 && (
                  <div className="bg-background rounded-2xl border border-border p-6 text-center">
                    <p className="text-muted-foreground text-sm">
                      모든 게시물을 확인했습니다
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
