import { ArrowLeft, CornerDownRight, MessageCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { PostCard } from "~/components/post-card";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";
import { client } from "~/lib/api-client";
import type { Post } from "~/types/post";

function flattenReplies(replies: Post[]): Post[] {
  const result: Post[] = [];
  for (const reply of replies) {
    result.push(reply);
    if (reply.replies?.length) {
      result.push(...flattenReplies(reply.replies));
    }
  }
  return result;
}

function countTotalReplies(replies: Post[]): number {
  let count = replies.length;
  for (const reply of replies) {
    count += countTotalReplies(reply.replies || []);
  }
  return count;
}

export default function PostDetail() {
  const { username, post_id } = useParams();
  const navigate = useNavigate();
  const { user, currentProfile } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [parentThread, setParentThread] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is community owner using data from useAuth
  const isCommunityOwner =
    user?.instances?.some((instance) => instance.role === "owner") ?? false;

  // Fetch post information
  const fetchPost = useCallback(async () => {
    if (!post_id) return;

    try {
      setIsLoading(true);
      const response = await client.app.posts[":post_id"].$get({
        param: { post_id },
        query: { profile_id: currentProfile?.id },
      });

      if (response.ok) {
        const result = await response.json();
        const postData = result.data;

        // Validate that the username matches the post author
        const cleanUsername = username?.startsWith("@")
          ? username.slice(1)
          : username;
        if (cleanUsername && postData.author.username !== cleanUsername) {
          setError("게시물을 찾을 수 없습니다");
          return;
        }

        // Convert API response format to match PostCard expectations
        // Normalize depths: main post becomes depth 0, replies adjust accordingly
        const mainPostDepth = postData.depth || 0;

        // Recursive function to adjust depths in nested replies
        const adjustReplyDepths = (
          replies: Post[],
          depthOffset: number,
        ): Post[] => {
          return (
            replies?.map(
              (reply): Post => ({
                ...reply,
                author: {
                  ...reply.author,
                  profile_picture_url: reply.author.profile_picture_url || null,
                },
                content_warning: reply.content_warning || null,
                in_reply_to_id: reply.in_reply_to_id || null,
                root_post_id: reply.root_post_id || null,
                images: reply.images || [],
                is_bookmarked: reply.is_bookmarked || false,
                reactions: reply.reactions || [],
                depth: Math.max(0, (reply.depth || 0) - depthOffset), // Adjust reply depths
                replies: adjustReplyDepths(reply.replies || [], depthOffset), // Recursive adjustment
              }),
            ) || []
          );
        };

        const convertedPost = {
          ...postData,
          author: {
            ...postData.author,
            profile_picture_url: postData.author.profile_picture_url || null,
          },
          content_warning: postData.content_warning || null,
          in_reply_to_id: postData.in_reply_to_id || null,
          root_post_id: postData.root_post_id || null,
          images: postData.images || [],
          reactions: postData.reactions || [],
          depth: 0, // Main post always has depth 0 on detail page
          replies: adjustReplyDepths(postData.replies || [], mainPostDepth),
        };
        setPost(convertedPost);

        // Set parent thread from API response
        if (postData.parent_thread && Array.isArray(postData.parent_thread)) {
          setParentThread(postData.parent_thread);
        } else {
          setParentThread([]);
        }
      } else if (response.status === 404) {
        setError("게시물을 찾을 수 없습니다");
      } else {
        setError("게시물을 불러오는 데 실패했습니다");
      }
    } catch (error) {
      console.error("Failed to fetch post:", error);
      setError("게시물을 불러오는 데 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  }, [post_id, username, currentProfile?.id]);

  useEffect(() => {
    if (post_id) {
      fetchPost();
    }
  }, [post_id, fetchPost]);

  const handleMainPostDelete = () => {
    // Navigate back to home after main post is deleted, with state to trigger refresh
    navigate("/", { state: { refetch: true } });
  };

  const handleRefresh = useCallback(() => {
    // Refresh the post data to show new replies or after reply deletion
    fetchPost();
  }, [fetchPost]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Spinner className="h-8 w-8 mx-auto mb-4" />
          <p className="text-muted-foreground">게시물을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="h-8 w-8 text-gray-400" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            {error || "게시물을 찾을 수 없습니다"}
          </h1>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-blue-600 hover:text-blue-700 font-medium"
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
            <div className="h-4 w-px bg-gray-300"></div>
            <div>
              <h1 className="text-xl font-bold text-foreground">게시물</h1>
              <p className="text-sm text-muted-foreground">
                {post.author.name}님의 게시물
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Parent thread - show if this is a reply */}
          {parentThread.length > 0 && (
            <div className="mb-4 space-y-4">
              <div className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
                <CornerDownRight className="h-4 w-4" />
                <span>답글 스레드 ({parentThread.length}개의 상위 게시물)</span>
              </div>
              <div className="space-y-4">
                {parentThread.map((parentPost) => (
                  <PostCard
                    key={parentPost.id}
                    post={{
                      ...parentPost,
                      replies: [],
                    }}
                    currentProfileId={currentProfile?.id}
                    onDelete={handleRefresh}
                    onRefresh={handleRefresh}
                    isCommunityOwner={isCommunityOwner}
                  />
                ))}
              </div>
            </div>
          )}

          <PostCard
            post={{
              ...post,
              replies: [],
            }}
            currentProfileId={currentProfile?.id}
            onDelete={handleMainPostDelete}
            onRefresh={handleRefresh}
            isCommunityOwner={isCommunityOwner}
          />

          {/* Detailed Reactions section */}
          {post.reactions && post.reactions.length > 0 && (
            <div className="mt-6 bg-card rounded-lg border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                반응 ({post.reactions.length})
              </h3>
              <div className="space-y-3">
                {(() => {
                  // Group reactions by emoji type
                  const reactionGroups = post.reactions.reduce<
                    Record<
                      string,
                      Array<{ id: string; username: string; name: string }>
                    >
                  >((acc, reaction) => {
                    if (!acc[reaction.emoji]) {
                      acc[reaction.emoji] = [];
                    }
                    if (reaction.user) {
                      const group = acc[reaction.emoji];
                      if (group) {
                        group.push(reaction.user);
                      }
                    }
                    return acc;
                  }, {});

                  return Object.entries(reactionGroups).map(
                    ([emoji, users]) => (
                      <div key={emoji} className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-10 h-10 bg-background rounded-full">
                          <span className="text-xl">{emoji}</span>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-muted-foreground mb-1">
                            {users.length}명이 반응했습니다
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {users.map((user, _index) => (
                              <button
                                key={user.id}
                                type="button"
                                className="inline-flex items-center px-2 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-sm rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors cursor-pointer"
                                onClick={() => navigate(`/@${user.username}`)}
                              >
                                {user.name} (@{user.username})
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ),
                  );
                })()}
              </div>
            </div>
          )}

          {/* Replies section */}
          <div className="mt-6">
            {(() => {
              const allReplies = flattenReplies(post.replies || []);
              const totalCount = countTotalReplies(post.replies || []);
              return (
                <>
                  <h3 className="text-lg font-semibold text-foreground mb-4">
                    답글 ({totalCount})
                  </h3>

                  {allReplies.length === 0 ? (
                    <div className="bg-card rounded-2xl shadow-sm border border-border p-8 text-center">
                      <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                        <MessageCircle className="h-8 w-8 text-gray-400" />
                      </div>
                      <h4 className="text-lg font-semibold text-foreground mb-2">
                        아직 답글이 없습니다
                      </h4>
                      <p className="text-muted-foreground">
                        첫 번째 답글을 작성해보세요!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {allReplies.map((reply) => (
                        <PostCard
                          key={reply.id}
                          post={{
                            ...reply,
                            replies: [],
                          }}
                          currentProfileId={currentProfile?.id}
                          onDelete={handleRefresh}
                          onRefresh={handleRefresh}
                          isCommunityOwner={isCommunityOwner}
                        />
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </main>
    </div>
  );
}
