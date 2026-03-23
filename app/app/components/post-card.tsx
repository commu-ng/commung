import { ChevronDown, ChevronUp } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { DirectMessageModal } from "~/components/DirectMessageModal";
import { ReportDialog } from "~/components/ReportDialog";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { useMarkdownWithMentions } from "~/hooks/useMarkdownWithMentions";
import { client } from "~/lib/api-client";
import type { Post, PostCardProps } from "~/types/post";
import { MessageSender } from "./message-sender";
import { PostEditor } from "./PostEditor";
import { ImageModal } from "./post/ImageModal";
import { PostCardActions } from "./post/PostCardActions";
import { PostCardContent } from "./post/PostCardContent";
import { PostCardHeader } from "./post/PostCardHeader";
import { PostCardImages } from "./post/PostCardImages";
import { PostCardReactions } from "./post/PostCardReactions";

// Helper function to count total replies recursively
function countTotalReplies(replies: Post[]): number {
  let count = replies.length;
  for (const reply of replies) {
    count += countTotalReplies(reply.replies || []);
  }
  return count;
}

export const PostCard = memo(function PostCard({
  post,
  currentProfileId,
  onDelete,
  onRefresh,
  isCommunityOwner = false,
  isModerator = false,
  hideBorder = false,
  isProfileView = false,
  displayDepth,
  isContinuation = false,
}: PostCardProps) {
  const { currentProfile } = useAuth();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showContentWarningContent, setShowContentWarningContent] =
    useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    filename: string;
  } | null>(null);
  const [showDMModal, setShowDMModal] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);

  // Check if current user is part of the conversation thread
  const currentUsername = currentProfile?.username;
  const isUserPartOfThread = useCallback(() => {
    if (!currentProfileId || !currentUsername) return false;

    // User is part of thread if they authored the root post
    if (post.author.id === currentProfileId) return true;

    // Check if user is mentioned in root post
    if (post.content.includes(`@${currentUsername}`)) return true;

    // User is part of thread if they authored any reply or are mentioned in any reply
    if (post.replies && post.replies.length > 0) {
      return post.replies.some(
        (reply) =>
          reply.author.id === currentProfileId ||
          reply.content.includes(`@${currentUsername}`),
      );
    }

    return false;
  }, [
    currentProfileId,
    currentUsername,
    post.author.id,
    post.content,
    post.replies,
  ]);

  // Collapse thread by default if user is not part of it
  const [isThreadCollapsed, setIsThreadCollapsed] = useState(
    !isUserPartOfThread(),
  );

  // Filter replies to show only relevant ones (for collapsed view)
  const filterRelevantReplies = useCallback(() => {
    if (!currentProfileId || !currentUsername || !post.replies) {
      return [];
    }

    const replies = post.replies;
    const relevantIds = new Set<string>();

    // Mark directly relevant replies
    for (const reply of replies) {
      if (
        reply.author.id === currentProfileId ||
        reply.content.includes(`@${currentUsername}`)
      ) {
        relevantIds.add(reply.id);
      }
    }

    // Add immediate context (parent and children)
    const withContext = new Set(relevantIds);
    for (const replyId of relevantIds) {
      const reply = replies.find((r) => r.id === replyId);
      if (reply?.in_reply_to_id) {
        withContext.add(reply.in_reply_to_id);
      }
      // Add direct children
      for (const r of replies) {
        if (r.in_reply_to_id === replyId) {
          withContext.add(r.id);
        }
      }
    }

    return replies.filter((r) => withContext.has(r.id));
  }, [currentProfileId, currentUsername, post.replies]);

  // Use the markdown hook for mention validation and rendering
  // For read-only posts, disable username validation to avoid API calls
  const { md } = useMarkdownWithMentions({
    content: post.content,
    useUsernameValidation: false,
  });

  // Use shared instance data instead of querying per post
  const { currentInstance } = useCurrentInstance();

  const now = new Date();
  const communityEnded = currentInstance
    ? now > new Date(currentInstance.ends_at)
    : false;
  const communityNotStarted = currentInstance
    ? now < new Date(currentInstance.starts_at)
    : false;
  const canInteract = !communityEnded && !communityNotStarted;

  const deletePost = useCallback(async () => {
    const profileIdToUse = currentProfileId;

    if (!profileIdToUse) {
      toast.error("프로필를 선택해주세요.");
      return;
    }

    try {
      const response = await client.app.posts[":post_id"].$delete({
        query: { profile_id: profileIdToUse },
        param: { post_id: post.id },
      });
      if (response.ok) {
        toast.success("게시물이 성공적으로 삭제되었습니다");
        onDelete?.();
      } else {
        throw new Error("게시물 삭제에 실패했습니다");
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error("게시물 삭제에 실패했습니다");
    }
  }, [currentProfileId, post.id, onDelete]);

  const handleEditSuccess = useCallback(() => {
    setShowEditForm(false);
    (onRefresh || onDelete)?.();
  }, [onRefresh, onDelete]);

  const addReaction = useCallback(
    async (emoji: string) => {
      if (!currentProfileId) return;

      try {
        const response = await client.app.posts[":post_id"].reactions.$post({
          param: { post_id: post.id },
          json: {
            profile_id: currentProfileId,
            emoji: emoji,
          },
        });

        if (response.ok) {
          // Trigger a refresh of the post data
          (onRefresh || onDelete)?.();
        } else {
          // Handle API error response
          try {
            const errorData = await response.json();
            const errorMessage =
              errorData && typeof errorData === "object"
                ? "error" in errorData &&
                  typeof errorData.error === "object" &&
                  errorData.error?.message
                  ? errorData.error.message
                  : "error" in errorData && typeof errorData.error === "string"
                    ? errorData.error
                    : undefined
                : undefined;
            toast.error(errorMessage || "반응을 추가할 수 없습니다");
          } catch {
            toast.error("반응을 추가할 수 없습니다");
          }
        }
      } catch (_err) {
        toast.error("반응 추가 중 오류가 발생했습니다");
      }
    },
    [currentProfileId, post.id, onRefresh, onDelete],
  );

  const removeReaction = useCallback(
    async (emoji: string) => {
      if (!currentProfileId) return;

      try {
        const response = await client.app.posts[":post_id"].reactions.$delete({
          param: { post_id: post.id },
          query: {
            profile_id: currentProfileId,
            emoji: emoji,
          },
        });

        if (response.ok) {
          // Trigger a refresh of the post data
          (onRefresh || onDelete)?.();
        } else {
          // Handle API error response
          try {
            const errorData = await response.json();
            const errorMessage =
              errorData && typeof errorData === "object"
                ? "error" in errorData &&
                  typeof errorData.error === "object" &&
                  errorData.error?.message
                  ? errorData.error.message
                  : "error" in errorData && typeof errorData.error === "string"
                    ? errorData.error
                    : undefined
                : undefined;
            toast.error(errorMessage || "반응을 제거할 수 없습니다");
          } catch {
            toast.error("반응을 제거할 수 없습니다");
          }
        }
      } catch (_err) {
        toast.error("반응 제거 중 오류가 발생했습니다");
      }
    },
    [currentProfileId, post.id, onRefresh, onDelete],
  );

  // Calculate styling based on depth - memoize to avoid recalculation
  const { depth, isReply, cardSize, padding } = useMemo(() => {
    const depth = displayDepth ?? (post.depth || 0);
    const isReply = depth > 0;
    const cardSize = isReply ? "text-xs" : "text-sm";
    const hasReplies = post.replies && post.replies.length > 0;
    // Only add bottom padding to deepest replies (those without children)
    const padding = isReply ? (hasReplies ? "pt-2 pl-2" : "py-2 pl-2") : "p-4";
    return { depth, isReply, cardSize, padding };
  }, [displayDepth, post.depth, post.replies]);

  return (
    <div
      className={`${
        post.announcement
          ? "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-l-4 border-l-amber-500 dark:border-l-amber-600 shadow-lg"
          : isReply
            ? "bg-background"
            : `bg-card ${!hideBorder ? "border-b border-border" : ""}`
      } ${isReply ? "" : ""} ${!hideBorder && !isReply ? "" : ""} overflow-hidden ${
        isReply && !isContinuation
          ? `border-l-4 ${
              depth === 1
                ? "border-l-blue-300 dark:border-l-blue-600"
                : depth === 2
                  ? "border-l-blue-400 dark:border-l-blue-500"
                  : depth === 3
                    ? "border-l-blue-500 dark:border-l-blue-400"
                    : depth === 4
                      ? "border-l-blue-600 dark:border-l-blue-300"
                      : "border-l-blue-700 dark:border-l-blue-200"
            }`
          : ""
      } ${cardSize}`}
    >
      <div className={padding}>
        {/* Header */}
        <PostCardHeader
          postId={post.id}
          author={post.author}
          createdAt={post.created_at}
          updatedAt={post.updated_at}
          isAnnouncement={post.announcement}
          isPinned={!!post.pinned_at}
          isReply={isReply}
          currentProfileId={currentProfileId}
          isModerator={isModerator}
          isOwner={isCommunityOwner}
          onDelete={deletePost}
          onEdit={() => setShowEditForm(true)}
          onReport={() => setShowReportDialog(true)}
        />

        {/* Edit Form */}
        {showEditForm ? (
          <div className="mt-4">
            <PostEditor
              post={post}
              onSaveSuccess={handleEditSuccess}
              onCancel={() => setShowEditForm(false)}
              isOwner={isCommunityOwner}
            />
          </div>
        ) : (
          <>
            {/* Content */}
            <PostCardContent
              content={post.content}
              contentWarning={post.content_warning}
              md={md}
              isReply={isReply}
              showContentWarningContent={showContentWarningContent}
              onToggleContentWarning={setShowContentWarningContent}
            />

            {/* Images */}
            {post.images && post.images.length > 0 && (
              <PostCardImages
                images={post.images}
                isReply={isReply}
                onImageClick={setSelectedImage}
                hidden={!!post.content_warning && !showContentWarningContent}
              />
            )}
          </>
        )}

        {/* Reply actions and reactions */}
        {!showEditForm && (
          <div
            className={`${
              isReply ? "mt-2 pt-2" : "mt-4 pt-3"
            } border-t border-border`}
          >
            {/* Action buttons row */}
            <div
              className={`flex items-center flex-wrap ${
                isReply ? "gap-2" : "gap-4"
              }`}
            >
              <PostCardActions
                postId={post.id}
                replyCount={
                  post.reply_count ?? countTotalReplies(post.replies || [])
                }
                isBookmarked={post.is_bookmarked || false}
                isPinned={!!post.pinned_at}
                isOwnPost={post.author.id === currentProfileId}
                isProfileView={isProfileView}
                currentProfileId={currentProfileId}
                isReply={isReply}
                onToggleReply={() => setShowReplyForm(!showReplyForm)}
                showReplyForm={showReplyForm}
                onBookmarkChange={() => {}} // Handled internally by PostCardActions
                onPinChange={() => {
                  // Trigger refresh to update the pinned status
                  (onRefresh || onDelete)?.();
                }}
                onOpenDMModal={() => setShowDMModal(true)}
              />

              {/* Reaction button and reactions display */}
              {currentProfile && (
                <PostCardReactions
                  reactions={post.reactions || []}
                  currentProfileId={currentProfile.id}
                  canInteract={canInteract}
                  onAddReaction={addReaction}
                  onRemoveReaction={removeReaction}
                  isReply={isReply}
                />
              )}
            </div>
          </div>
        )}

        {/* Inline reply form */}
        {showReplyForm && !showEditForm && (
          <div
            className={`${
              isReply ? "mt-2 pl-2" : "mt-4 pl-4"
            } border-l-2 border-blue-200`}
          >
            <MessageSender
              key={currentProfile?.id || "no-profile"}
              replyToId={post.id}
              placeholder={`@${post.author.username}님에게 답글을 작성하세요...`}
              initialValue={`@${post.author.username} `}
              onPostSuccess={() => {
                toast.success("답글이 작성되었습니다");
                setShowReplyForm(false);
                (onRefresh || onDelete)?.();
              }}
            />
          </div>
        )}

        {/* Nested replies */}
        {!showEditForm &&
          post.replies &&
          post.replies.length > 0 &&
          (() => {
            const filteredReplies = filterRelevantReplies();
            const repliesToShow = isThreadCollapsed
              ? filteredReplies
              : post.replies;
            const hasHiddenReplies =
              filteredReplies.length < post.replies.length;

            const totalReplyCount = post.reply_count ?? post.replies.length;

            return (
              <div
                className={`mt-3 pt-3 border-t border-border ${isReply ? "-ml-2" : ""}`}
              >
                {/* Show toggle button only if there are hidden replies */}
                {hasHiddenReplies && (
                  <button
                    type="button"
                    onClick={() => setIsThreadCollapsed(!isThreadCollapsed)}
                    className="flex items-center gap-2 mb-2 hover:opacity-70 transition-opacity"
                  >
                    <span className="text-xs text-muted-foreground font-medium">
                      {isThreadCollapsed
                        ? `답글 ${filteredReplies.length}/${totalReplyCount}개`
                        : `답글 ${totalReplyCount}개`}
                    </span>
                    {isThreadCollapsed ? (
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    ) : (
                      <ChevronUp className="w-3 h-3 text-muted-foreground" />
                    )}
                  </button>
                )}
                {/* Always show replies (filtered when collapsed, all when expanded) */}
                <div>
                  {repliesToShow.map((reply) => {
                    // Only increase depth when branching (parent has multiple children)
                    const childDisplayDepth =
                      post.replies.length === 1 && depth > 0
                        ? depth
                        : depth + 1;
                    return (
                      <PostCard
                        key={reply.id}
                        post={reply}
                        displayDepth={childDisplayDepth}
                        isContinuation={childDisplayDepth <= depth}
                        currentProfileId={currentProfileId}
                        onDelete={onDelete}
                        onRefresh={onRefresh}
                        isCommunityOwner={isCommunityOwner}
                        isModerator={isModerator}
                        isProfileView={isProfileView}
                      />
                    );
                  })}
                </div>
                {post.has_more_replies && (
                  <Link
                    to={`/@${post.author.username}/${post.root_post_id ?? post.id}`}
                    className="block mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    답글 {totalReplyCount}개 모두 보기
                  </Link>
                )}
              </div>
            );
          })()}
      </div>

      {/* Image Modal */}
      <ImageModal
        image={selectedImage}
        onClose={() => setSelectedImage(null)}
      />

      {/* Direct Message Modal */}
      {currentProfileId && (
        <DirectMessageModal
          postId={post.id}
          postAuthor={{
            username: post.author.username,
            name: post.author.name,
          }}
          isOpen={showDMModal}
          onClose={() => setShowDMModal(false)}
          currentProfileId={currentProfileId}
          receiverId={post.author.id}
        />
      )}

      {/* Report Dialog */}
      {currentProfileId && (
        <ReportDialog
          open={showReportDialog}
          onOpenChange={setShowReportDialog}
          postId={post.id}
          profileId={currentProfileId}
        />
      )}
    </div>
  );
});
