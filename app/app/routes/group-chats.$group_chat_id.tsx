import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { useImageUpload } from "~/hooks/useImageUpload";
import { client } from "~/lib/api-client";
import type { Route } from "./+types/group-chats.$group_chat_id";

interface GroupChatMessage {
  id: string;
  content: string;
  created_at: string;
  is_from_me: boolean;
  sender: {
    id: string;
    name: string;
    username: string;
    profile_picture_url: string | null;
  };
  reactions?: Array<{
    emoji: string;
    count: number;
    profiles: Array<{
      id: string;
      name: string;
      username: string;
      profile_picture_url: string | null;
    }>;
  }>;
  images?: Array<{
    id: string;
    url: string;
    width: number;
    height: number;
  }>;
}

interface GroupChatMember {
  id: string;
  name: string;
  username: string;
  profile_picture_url: string | null;
}

import {
  ArrowLeft,
  Image,
  MessageCircle,
  Send,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { GroupChatMessageReactions } from "~/components/GroupChatMessageReactions";
import { LoginButton } from "~/components/LoginButton";
import { MessageBubble } from "~/components/MessageBubble";
import { ProfileAvatar } from "~/components/profile-avatar";
import { Spinner } from "~/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "그룹 채팅" },
    { name: "description", content: "그룹 채팅" },
  ];
}

interface GroupChatInfo {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  created_by_id: string;
  members: GroupChatMember[];
}

export default function GroupChatDetail() {
  const { group_chat_id } = useParams();
  const [groupChat, setGroupChat] = useState<GroupChatInfo | null>(null);
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showMemberDialog, setShowMemberDialog] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  const { isAuthenticated, currentProfile, isLoading: authLoading } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);
  const _navigate = useNavigate();
  const imageUploadId = useId();
  const {
    images,
    uploadedImageIds,
    isUploadingImages,
    handleImageSelect: handleImageSelectFromHook,
    removeImage,
    clearImages,
  } = useImageUpload();

  const { instanceSlug } = useCurrentInstance();

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const threshold = 100;
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold
    );
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const hasNewMessages = messages.length > prevMessageCountRef.current;
    const isInitial = isInitialLoadRef.current && messages.length > 0;

    if (isInitial) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      }, 50);
      isInitialLoadRef.current = false;
    } else if (hasNewMessages && isNearBottom()) {
      scrollToBottom();
    }

    prevMessageCountRef.current = messages.length;
  }, [messages, isLoading, scrollToBottom, isNearBottom]);

  // Poll for new messages every 5 seconds
  const currentProfileId = currentProfile?.id;
  useEffect(() => {
    if (
      !isAuthenticated ||
      !instanceSlug ||
      !currentProfileId ||
      !group_chat_id
    )
      return;

    const interval = setInterval(async () => {
      try {
        const messagesResponse = await client.app["group-chats"][
          ":group_chat_id"
        ].messages.$get({
          param: { group_chat_id },
          query: { profile_id: currentProfileId },
        });

        if (messagesResponse.ok) {
          const messagesResult = await messagesResponse.json();
          const transformedMessages: GroupChatMessage[] =
            messagesResult.data.map(
              (message: {
                id: string;
                content: string;
                created_at: string;
                is_sender: boolean;
                sender: {
                  id: string;
                  name: string;
                  username: string;
                  profile_picture_url: string | null;
                };
                reactions: Array<{
                  emoji: string;
                  count: number;
                  profiles: Array<{
                    id: string;
                    name: string;
                    username: string;
                    profile_picture_url: string | null;
                  }>;
                }>;
                images: Array<{
                  id: string;
                  url: string;
                  width: number;
                  height: number;
                }>;
              }) => ({
                id: message.id,
                content: message.content,
                created_at: message.created_at,
                is_from_me: message.is_sender || false,
                sender: {
                  id: message.sender.id,
                  name: message.sender.name,
                  username: message.sender.username,
                  profile_picture_url:
                    message.sender.profile_picture_url || null,
                },
                reactions: message.reactions || [],
                images: message.images || [],
              }),
            );
          setMessages(
            transformedMessages.sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime(),
            ),
          );

          // Mark messages as read
          client.app["group-chats"][":group_chat_id"]["mark-read"]
            .$post({
              param: { group_chat_id },
              query: { profile_id: currentProfileId },
            })
            .catch((error) => {
              console.error("Error marking messages as read:", error);
            });
        }
      } catch (err) {
        console.error("Failed to poll group chat messages:", err);
      }
    }, 1000); // 1 second

    return () => clearInterval(interval);
  }, [isAuthenticated, instanceSlug, currentProfileId, group_chat_id]);

  useEffect(() => {
    if (!isAuthenticated || !instanceSlug || !currentProfile || !group_chat_id)
      return;

    const fetchGroupChatData = async () => {
      try {
        setIsLoading(true);

        // Fetch group chat info and messages in parallel
        const [chatResponse, messagesResponse] = await Promise.all([
          client.app["group-chats"][":group_chat_id"].$get({
            param: { group_chat_id },
            query: { profile_id: currentProfile.id },
          }),
          client.app["group-chats"][":group_chat_id"].messages.$get({
            param: { group_chat_id },
            query: { profile_id: currentProfile.id },
          }),
        ]);

        // Mark messages as read after fetching
        client.app["group-chats"][":group_chat_id"]["mark-read"]
          .$post({
            param: { group_chat_id },
            query: { profile_id: currentProfile.id },
          })
          .catch((error) => {
            console.error("Error marking messages as read:", error);
            // Don't block the UI if marking as read fails
          });

        if (chatResponse.ok) {
          const chatResult = await chatResponse.json();
          const chatData = chatResult.data;
          // Transform API response to match GroupChatInfo interface
          const transformedChatData: GroupChatInfo = {
            id: chatData.id,
            name: chatData.name,
            created_at: chatData.created_at,
            updated_at: chatData.updated_at,
            created_by_id: chatData.created_by_id,
            members: chatData.members.map(
              (member: {
                id: string;
                name: string;
                username: string;
                profile_picture_url: string | null;
              }) => ({
                id: member.id,
                name: member.name,
                username: member.username,
                profile_picture_url: member.profile_picture_url || null,
              }),
            ),
          };
          setGroupChat(transformedChatData);
        } else {
          setError("그룹 채팅을 찾을 수 없습니다");
          return;
        }

        if (messagesResponse.ok) {
          const messagesResult = await messagesResponse.json();
          // Transform API response to match GroupChatMessage interface
          const transformedMessages: GroupChatMessage[] =
            messagesResult.data.map(
              (message: {
                id: string;
                content: string;
                created_at: string;
                is_sender: boolean;
                sender: {
                  id: string;
                  name: string;
                  username: string;
                  profile_picture_url: string | null;
                };
                reactions: Array<{
                  emoji: string;
                  count: number;
                  profiles: Array<{
                    id: string;
                    name: string;
                    username: string;
                    profile_picture_url: string | null;
                  }>;
                }>;
                images: Array<{
                  id: string;
                  url: string;
                  width: number;
                  height: number;
                }>;
              }) => ({
                id: message.id,
                content: message.content,
                created_at: message.created_at,
                is_from_me: message.is_sender || false,
                sender: {
                  id: message.sender.id,
                  name: message.sender.name,
                  username: message.sender.username,
                  profile_picture_url:
                    message.sender.profile_picture_url || null,
                },
                reactions: message.reactions || [],
                images: message.images || [],
              }),
            );
          setMessages(
            transformedMessages.sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime(),
            ),
          );
        } else {
          setError("메시지를 불러올 수 없습니다");
        }
      } catch (_err) {
        setError("그룹 채팅을 불러오는 중 오류가 발생했습니다");
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroupChatData();
  }, [isAuthenticated, instanceSlug, currentProfile, group_chat_id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      (!newMessage.trim() && uploadedImageIds.length === 0) ||
      !currentProfile ||
      !group_chat_id ||
      isSending
    )
      return;

    try {
      setIsSending(true);

      const response = await client.app["group-chats"][
        ":group_chat_id"
      ].messages.$post({
        param: { group_chat_id },
        json: {
          content: newMessage.trim(),
          profile_id: currentProfile.id,
          image_ids: uploadedImageIds.length > 0 ? uploadedImageIds : undefined,
        },
      });

      if (response.ok) {
        const result = await response.json();
        const messageData = result.data;
        // Transform API response to match GroupChatMessage interface
        const transformedMessage: GroupChatMessage = {
          id: messageData.id,
          content: messageData.content,
          created_at: messageData.created_at,
          is_from_me: messageData.is_sender || false,
          sender: {
            id: messageData.sender.id,
            name: messageData.sender.name,
            username: messageData.sender.username,
            profile_picture_url: messageData.sender.profile_picture_url || null,
          },
          images: messageData.images || [],
        };
        setMessages((prev) => [...prev, transformedMessage]);
        setNewMessage("");
        clearImages();
      } else {
        setError("메시지 전송에 실패했습니다");
      }
    } catch (_err) {
      setError("메시지 전송 중 오류가 발생했습니다");
    } finally {
      setIsSending(false);
    }
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    if (!currentProfile || !group_chat_id) return;

    try {
      const response = await client.app["group-chats"][
        ":group_chat_id"
      ].messages[":message_id"].reactions.$post({
        param: { group_chat_id, message_id: messageId },
        json: {
          profile_id: currentProfile.id,
          emoji,
        },
      });

      if (response.ok) {
        // Optimistically update the UI
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === messageId) {
              const reactions = msg.reactions || [];
              const existingReaction = reactions.find((r) => r.emoji === emoji);

              if (existingReaction) {
                // Add current profile to existing reaction
                return {
                  ...msg,
                  reactions: reactions.map((r) =>
                    r.emoji === emoji
                      ? {
                          ...r,
                          count: r.count + 1,
                          profiles: [
                            ...r.profiles,
                            {
                              id: currentProfile.id,
                              name: currentProfile.name,
                              username: currentProfile.username,
                              profile_picture_url:
                                currentProfile.profile_picture_url,
                            },
                          ],
                        }
                      : r,
                  ),
                };
              } else {
                // Create new reaction
                return {
                  ...msg,
                  reactions: [
                    ...reactions,
                    {
                      emoji,
                      count: 1,
                      profiles: [
                        {
                          id: currentProfile.id,
                          name: currentProfile.name,
                          username: currentProfile.username,
                          profile_picture_url:
                            currentProfile.profile_picture_url,
                        },
                      ],
                    },
                  ],
                };
              }
            }
            return msg;
          }),
        );
      }
    } catch (err) {
      console.error("Error adding reaction:", err);
    }
  };

  const handleRemoveReaction = async (messageId: string, emoji: string) => {
    if (!currentProfile || !group_chat_id) return;

    try {
      const response = await client.app["group-chats"][
        ":group_chat_id"
      ].messages[":message_id"].reactions.$delete({
        param: { group_chat_id, message_id: messageId },
        query: {
          profile_id: currentProfile.id,
          emoji,
        },
      });

      if (response.ok) {
        // Optimistically update the UI
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === messageId) {
              const reactions = msg.reactions || [];
              return {
                ...msg,
                reactions: reactions
                  .map((r) =>
                    r.emoji === emoji
                      ? {
                          ...r,
                          count: r.count - 1,
                          profiles: r.profiles.filter(
                            (p) => p.id !== currentProfile.id,
                          ),
                        }
                      : r,
                  )
                  .filter((r) => r.count > 0), // Remove reactions with 0 count
              };
            }
            return msg;
          }),
        );
      }
    } catch (err) {
      console.error("Error removing reaction:", err);
    }
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
              <Users className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">
              로그인이 필요합니다
            </h1>
            <p className="text-muted-foreground mb-6">
              그룹 채팅을 확인하려면 로그인해주세요.
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
                그룹 채팅을 불러오는 중...
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !groupChat) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-card rounded-2xl shadow-sm border border-border p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">
              오류가 발생했습니다
            </h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Link
              to="/group-chats"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              그룹 채팅 목록으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link
                to="/messages"
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                메시지 목록
              </Link>
              {groupChat && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h1 className="font-bold text-foreground">
                      {groupChat.name}
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      {groupChat.members.length}명
                    </p>
                  </div>
                </div>
              )}
            </div>
            <Dialog open={showMemberDialog} onOpenChange={setShowMemberDialog}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                >
                  <Settings className="h-5 w-5" />
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>그룹 멤버</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {groupChat?.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-background"
                    >
                      <div className="flex items-center gap-3">
                        <ProfileAvatar
                          profilePictureUrl={member.profile_picture_url}
                          name={member.name}
                          username={member.username}
                          size="sm"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {member.name}
                            </span>
                            {member.id === groupChat.created_by_id && (
                              <Shield className="h-4 w-4 text-blue-600" />
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            @{member.username}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-4 overflow-hidden">
        <div className="bg-card rounded-lg shadow-sm border border-border h-full flex flex-col">
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {messages.map((message) => {
              const hasReactions =
                message.reactions && message.reactions.length > 0;

              return (
                <div
                  key={message.id}
                  className={`flex ${
                    message.is_from_me ? "justify-end" : "justify-start"
                  }`}
                >
                  <MessageBubble
                    content={message.content}
                    timestamp={formatTime(message.created_at)}
                    isFromMe={message.is_from_me}
                    senderName={message.sender.name}
                    senderAvatar={
                      !message.is_from_me ? (
                        <ProfileAvatar
                          profilePictureUrl={message.sender.profile_picture_url}
                          name={message.sender.name}
                          username={message.sender.username}
                          size="sm"
                        />
                      ) : undefined
                    }
                    onClick={
                      hasReactions
                        ? () => setSelectedMessageId(message.id)
                        : undefined
                    }
                    hasReactions={hasReactions}
                    images={message.images}
                    currentProfileId={currentProfile?.id}
                  >
                    {hasReactions ? (
                      <GroupChatMessageReactions
                        reactions={message.reactions || []}
                        currentProfileId={currentProfile?.id}
                        onAddReaction={(emoji) =>
                          handleAddReaction(message.id, emoji)
                        }
                        onRemoveReaction={(emoji) =>
                          handleRemoveReaction(message.id, emoji)
                        }
                        messageContent={message.content}
                        senderName={message.sender.name}
                        isModalOpen={selectedMessageId === message.id}
                        onModalClose={() => setSelectedMessageId(null)}
                        isFromMe={message.is_from_me}
                      />
                    ) : (
                      currentProfile && (
                        <GroupChatMessageReactions
                          reactions={[]}
                          currentProfileId={currentProfile.id}
                          onAddReaction={(emoji) =>
                            handleAddReaction(message.id, emoji)
                          }
                          onRemoveReaction={(emoji) =>
                            handleRemoveReaction(message.id, emoji)
                          }
                          messageContent={message.content}
                          senderName={message.sender.name}
                          isModalOpen={false}
                          onModalClose={() => {}}
                          isFromMe={message.is_from_me}
                        />
                      )
                    )}
                  </MessageBubble>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="border-t border-border p-4">
            {/* Image Previews */}
            {images.length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {images.map((image, index) => (
                  <div key={image.id} className="relative">
                    <img
                      src={image.preview}
                      alt="Preview"
                      className="h-20 w-20 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    handleImageSelectFromHook(e.target.files);
                  }
                }}
                className="hidden"
                id={imageUploadId}
                disabled={isSending || isUploadingImages}
              />
              <label
                htmlFor={imageUploadId}
                className="px-4 py-2 border border-border rounded-lg hover:bg-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Image className="h-5 w-5" />
              </label>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="메시지를 입력하세요..."
                className="flex-1 px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSending}
              />
              <button
                type="submit"
                disabled={
                  (!newMessage.trim() && uploadedImageIds.length === 0) ||
                  isSending
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSending ? (
                  <Spinner className="h-5 w-5 text-white" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
