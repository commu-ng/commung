import { Users } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { LoginButton } from "~/components/LoginButton";
import { MessageSender } from "~/components/message-sender";
import { PostList, type PostListRef } from "~/components/post-list";
import {
  ScheduledPostsList,
  type ScheduledPostsListRef,
} from "~/components/scheduled-posts-list";
import { EmptyState } from "~/components/shared/EmptyState";
import { useUnreadCount } from "~/contexts/UnreadCountContext";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";

export default function Home() {
  const postListRef = useRef<PostListRef>(null);
  const scheduledPostsRef = useRef<ScheduledPostsListRef>(null);
  const location = useLocation();
  const {
    isLoading,
    isAuthenticated,
    belongsToCurrentInstance,
    consoleUrl,
    currentProfile,
  } = useAuth();
  const { currentInstance } = useCurrentInstance();
  const { isHeaderVisible } = useUnreadCount();

  const handlePostSuccess = () => {
    postListRef.current?.refresh();
    scheduledPostsRef.current?.refresh();
  };

  // Refetch posts when navigating to the page or switching profiles
  // biome-ignore lint/correctness/useExhaustiveDependencies: We want to refetch when profile changes
  useEffect(() => {
    if (isAuthenticated && belongsToCurrentInstance) {
      postListRef.current?.refresh();
    }
  }, [isAuthenticated, belongsToCurrentInstance, currentProfile?.id]);

  // Refetch posts when navigating back from deleted post
  useEffect(() => {
    if (location.state?.refetch) {
      postListRef.current?.refresh();
      // Clear the state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Poll for new posts every 60 seconds (only when header is visible)
  useEffect(() => {
    if (!isAuthenticated || !belongsToCurrentInstance) return;

    // Only poll when header is visible in viewport
    if (!isHeaderVisible) return;

    const interval = setInterval(() => {
      postListRef.current?.refresh();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated, belongsToCurrentInstance, isHeaderVisible]);

  if (!isAuthenticated && !isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="max-w-md mx-auto px-4">
          <EmptyState
            icon={Users}
            title="로그인이 필요합니다"
            description="이 커뮤에 참여하려면 로그인해주세요."
            actions={<LoginButton />}
          />
        </div>
      </div>
    );
  }

  if (!belongsToCurrentInstance && !isLoading) {
    const applyUrl = currentInstance?.slug
      ? `${consoleUrl}/communities/${currentInstance.slug}/apply`
      : consoleUrl;

    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="max-w-md mx-auto px-4">
          <EmptyState
            icon={Users}
            title="가입 신청이 필요합니다"
            description="이 커뮤에 가입하려면 신청이 필요합니다."
            actions={
              <a
                href={applyUrl}
                className="inline-flex items-center justify-center px-7 py-3 bg-primary text-primary-foreground font-semibold rounded-full shadow-marsh hover:shadow-marsh-lg hover:-translate-y-px transition-all"
              >
                가입 신청하기
              </a>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <main className="py-4">
      <div className="space-y-0">
        {/* Message Composer */}
        <div className="border-b border-border/70">
          <MessageSender
            key={currentProfile?.id || "no-profile"}
            onPostSuccess={handlePostSuccess}
          />
        </div>

        {/* Scheduled Posts */}
        <ScheduledPostsList ref={scheduledPostsRef} />

        {/* Posts Feed */}
        <div>
          <PostList ref={postListRef} />
        </div>
      </div>
    </main>
  );
}
