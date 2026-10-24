import { Bookmark, MessageCircle, Pin, SendIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { client } from "~/lib/api-client";

interface PostCardActionsProps {
  postId: string;
  replyCount?: number;
  isBookmarked: boolean;
  isPinned?: boolean;
  isOwnPost?: boolean;
  isProfileView?: boolean;
  currentProfileId?: string;
  isReply?: boolean;
  onToggleReply: () => void;
  showReplyForm: boolean;
  onBookmarkChange: (isBookmarked: boolean) => void;
  onPinChange?: (isPinned: boolean) => void;
  onOpenDMModal?: () => void;
}

export function PostCardActions({
  postId,
  replyCount = 0,
  isBookmarked: initialBookmarked,
  isPinned: initialPinned = false,
  isOwnPost = false,
  isProfileView = false,
  currentProfileId,
  isReply = false,
  onToggleReply,
  showReplyForm,
  onBookmarkChange,
  onPinChange,
  onOpenDMModal,
}: PostCardActionsProps) {
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [isBookmarkLoading, setIsBookmarkLoading] = useState(false);
  const [isPinned, setIsPinned] = useState(initialPinned);
  const [isPinLoading, setIsPinLoading] = useState(false);

  // Sync bookmark state when prop changes
  useEffect(() => {
    setIsBookmarked(initialBookmarked);
  }, [initialBookmarked]);

  // Sync pinned state when prop changes
  useEffect(() => {
    setIsPinned(initialPinned);
  }, [initialPinned]);

  const toggleBookmark = async () => {
    if (!currentProfileId) {
      toast.error("프로필를 선택해주세요.");
      return;
    }

    setIsBookmarkLoading(true);
    try {
      if (isBookmarked) {
        const response = await client.app.posts[":post_id"].bookmark.$delete({
          query: { profile_id: currentProfileId },
          param: { post_id: postId },
        });
        if (response.ok) {
          setIsBookmarked(false);
          onBookmarkChange(false);
          toast.success("북마크가 제거되었습니다");
        } else {
          throw new Error("북마크 제거에 실패했습니다");
        }
      } else {
        const response = await client.app.posts[":post_id"].bookmark.$post({
          query: { profile_id: currentProfileId },
          param: { post_id: postId },
        });
        if (response.ok) {
          setIsBookmarked(true);
          onBookmarkChange(true);
          toast.success("북마크에 추가되었습니다");
        } else {
          throw new Error("북마크 추가에 실패했습니다");
        }
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error);
      toast.error("북마크 처리에 실패했습니다");
    } finally {
      setIsBookmarkLoading(false);
    }
  };

  const togglePin = async () => {
    if (!currentProfileId) {
      toast.error("프로필을 선택해주세요.");
      return;
    }

    setIsPinLoading(true);
    try {
      if (isPinned) {
        const response = await client.app.posts[":post_id"].pin.$delete({
          query: { profile_id: currentProfileId },
          param: { post_id: postId },
        });
        if (response.ok) {
          setIsPinned(false);
          onPinChange?.(false);
          toast.success("게시물 고정이 해제되었습니다");
        } else {
          const errorData = await response.json();
          throw new Error(
            (errorData as { error?: string }).error ||
              "고정 해제에 실패했습니다",
          );
        }
      } else {
        const response = await client.app.posts[":post_id"].pin.$post({
          query: { profile_id: currentProfileId },
          param: { post_id: postId },
        });
        if (response.ok) {
          setIsPinned(true);
          onPinChange?.(true);
          toast.success("게시물이 고정되었습니다");
        } else {
          const errorData = await response.json();
          throw new Error(
            (errorData as { error?: string }).error || "고정에 실패했습니다",
          );
        }
      }
    } catch (error) {
      console.error("Error toggling pin:", error);
      toast.error(
        error instanceof Error ? error.message : "고정 처리에 실패했습니다",
      );
    } finally {
      setIsPinLoading(false);
    }
  };

  return (
    <div className={`flex items-center ${isReply ? "gap-2" : "gap-4"}`}>
      <button
        type="button"
        onClick={onToggleReply}
        className={`inline-flex items-center gap-1 ${
          isReply ? "text-xs" : "text-sm"
        } text-muted-foreground hover:text-primary transition-colors`}
      >
        <MessageCircle className={isReply ? "h-3 w-3" : "h-4 w-4"} />
        <span>
          {showReplyForm ? "답글 취소" : "답글"}
          {replyCount > 0 && (
            <span className="ml-1 text-xs bg-accent text-muted-foreground px-2 py-0.5 rounded-full">
              {replyCount}
            </span>
          )}
        </span>
      </button>
      {currentProfileId && (
        <button
          type="button"
          onClick={toggleBookmark}
          disabled={isBookmarkLoading}
          className={`inline-flex items-center gap-1 ${
            isReply ? "text-xs" : "text-sm"
          } ${
            isBookmarked
              ? "text-primary"
              : "text-muted-foreground hover:text-primary"
          } transition-colors disabled:opacity-50`}
        >
          <Bookmark
            className={`${isReply ? "h-3 w-3" : "h-4 w-4"} ${
              isBookmarked ? "fill-current" : ""
            }`}
          />
          <span>{isBookmarked ? "북마크됨" : "북마크"}</span>
        </button>
      )}
      {currentProfileId && !isOwnPost && onOpenDMModal && (
        <button
          type="button"
          onClick={onOpenDMModal}
          className={`inline-flex items-center gap-1 ${
            isReply ? "text-xs" : "text-sm"
          } text-muted-foreground hover:text-primary transition-colors`}
        >
          <SendIcon className={isReply ? "h-3 w-3" : "h-4 w-4"} />
          <span>메시지</span>
        </button>
      )}
      {isProfileView && isOwnPost && currentProfileId && (
        <button
          type="button"
          onClick={togglePin}
          disabled={isPinLoading}
          className={`inline-flex items-center gap-1 ${
            isReply ? "text-xs" : "text-sm"
          } ${
            isPinned
              ? "text-primary"
              : "text-muted-foreground hover:text-primary"
          } transition-colors disabled:opacity-50`}
        >
          <Pin
            className={`${isReply ? "h-3 w-3" : "h-4 w-4"} ${
              isPinned ? "fill-current" : ""
            }`}
          />
          <span>{isPinned ? "고정됨" : "고정"}</span>
        </button>
      )}
    </div>
  );
}
