import {
  ArrowLeft,
  MessageCircle,
  Paperclip,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { DirectMessageReactions } from "~/components/DirectMessageReactions";
import { uploadImage } from "~/lib/upload-image";
import { LoginButton } from "~/components/LoginButton";
import { MessageBubble } from "~/components/MessageBubble";
import { ProfileAvatar } from "~/components/profile-avatar";
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
import { client, getErrorMessage } from "~/lib/api-client";
import type { Route } from "./+types/messages.$username";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `${params.username}님과의 대화` },
    { name: "description", content: "메시지 대화" },
  ];
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  is_sender: boolean;
  sender: {
    id: string;
    username: string;
    name: string;
    profile_picture_url: string | null;
  };
  reactions: Array<{
    emoji: string;
    user: {
      id: string;
      username: string;
      name: string;
    };
  }>;
  images?: Array<{
    id: string;
    url: string;
    width: number;
    height: number;
  }>;
}

import type { Profile } from "~/types/profile";

export default function MessageConversation() {
  const { username } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(
    null,
  );
  const [confirmDeleteMessageId, setConfirmDeleteMessageId] = useState<
    string | null
  >(null);
  const { isAuthenticated, currentProfile, isLoading: authLoading } = useAuth();
  const { instanceSlug } = useCurrentInstance();
  const { refreshUnreadCounts } = useUnreadCount();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevMessageCountRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);

  // Image handling state
  interface ImageObject {
    tempId: string;
    file: File;
    preview: string;
    uploadedId?: string;
  }
  const [images, setImages] = useState<ImageObject[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

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

  // Poll for new messages every 10 seconds
  useEffect(() => {
    if (
      !isAuthenticated ||
      !instanceSlug ||
      !username ||
      !currentProfile ||
      !otherProfile
    )
      return;

    const interval = setInterval(async () => {
      try {
        const messagesResponse = await client.app.conversations[
          ":other_profile_id"
        ].$get({
          param: { other_profile_id: otherProfile.id },
          query: { profile_id: currentProfile.id },
        });
        if (messagesResponse.ok) {
          const messagesResult = await messagesResponse.json();
          const transformedMessages: Message[] = messagesResult.data.map(
            (message: {
              id: string;
              content: string;
              created_at: string;
              read_at: string | null;
              is_sender: boolean;
              sender: {
                id: string;
                username: string;
                name: string;
                profile_picture_url: string | null;
              };
              reactions: Array<{
                emoji: string;
                user: { id: string; username: string; name: string };
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
              read_at: message.read_at,
              is_sender: message.is_sender,
              sender: {
                id: message.sender.id,
                username: message.sender.username,
                name: message.sender.name,
                profile_picture_url: message.sender.profile_picture_url || null,
              },
              reactions: message.reactions,
              images: message.images,
            }),
          );
          setMessages(transformedMessages.reverse());

          // Mark messages as read
          await client.app.conversations[":other_profile_id"][
            "mark-read"
          ].$post({
            param: { other_profile_id: otherProfile.id },
            query: { profile_id: currentProfile.id },
          });
          refreshUnreadCounts();
        }
      } catch (err) {
        console.error("Failed to poll messages:", err);
      }
    }, 1000); // 1 second

    return () => clearInterval(interval);
  }, [
    isAuthenticated,
    instanceSlug,
    username,
    currentProfile,
    otherProfile,
    refreshUnreadCounts,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !instanceSlug || !username) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Get profile info first
        const profileResponse = await client.app.profiles[":username"].$get({
          param: { username },
        });
        if (!profileResponse.ok) {
          setError("사용자를 찾을 수 없습니다");
          return;
        }
        const profileResult = await profileResponse.json();
        const profileData = profileResult.data;
        setOtherProfile(profileData);

        // Get conversation messages
        if (!authLoading && !currentProfile) {
          setError("프로필를 선택해주세요");
          return;
        }

        // Wait for auth loading to complete
        if (authLoading || !currentProfile) {
          return;
        }

        const messagesResponse = await client.app.conversations[
          ":other_profile_id"
        ].$get({
          param: { other_profile_id: profileData.id },
          query: { profile_id: currentProfile.id },
        });
        if (messagesResponse.ok) {
          const messagesResult = await messagesResponse.json();
          // Transform API response to match Message interface
          const transformedMessages: Message[] = messagesResult.data.map(
            (message: {
              id: string;
              content: string;
              created_at: string;
              read_at: string | null;
              is_sender: boolean;
              sender: {
                id: string;
                username: string;
                name: string;
                profile_picture_url: string | null;
              };
              reactions: Array<{
                emoji: string;
                user: { id: string; username: string; name: string };
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
              read_at: message.read_at,
              is_sender: message.is_sender,
              sender: {
                id: message.sender.id,
                username: message.sender.username,
                name: message.sender.name,
                profile_picture_url: message.sender.profile_picture_url || null,
              },
              reactions: message.reactions,
              images: message.images,
            }),
          );
          setMessages(transformedMessages.reverse()); // Reverse to show oldest first

          // Mark messages as read
          try {
            await client.app.conversations[":other_profile_id"][
              "mark-read"
            ].$post({
              param: { other_profile_id: profileData.id },
              query: { profile_id: currentProfile.id },
            });
            // Refresh unread counts in header
            refreshUnreadCounts();
          } catch (err) {
            console.error("Failed to mark messages as readAt:", err);
          }
        } else {
          setError("메시지를 불러올 수 없습니다");
        }
      } catch (_err) {
        setError("데이터를 불러오는 중 오류가 발생했습니다");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [
    isAuthenticated,
    instanceSlug,
    username,
    authLoading,
    currentProfile, // Refresh unread counts in header
    refreshUnreadCounts,
  ]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles: File[] = [];
    for (const file of files) {
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      if (!allowedTypes.includes(file.type)) {
        toast.error("이미지 파일만 업로드 가능합니다 (JPG, PNG, GIF, WebP)");
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error("이미지 크기는 10MB 이하여야 합니다");
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    const newImageObjects: ImageObject[] = validFiles.map((file) => ({
      tempId: `${Date.now()}-${Math.random()}`,
      file,
      preview: "",
    }));

    setImages((prev) => [...prev, ...newImageObjects]);

    // Load previews asynchronously
    newImageObjects.forEach((imageObj) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === "string") {
          setImages((prev) =>
            prev.map((img) =>
              img.tempId === imageObj.tempId
                ? { ...img, preview: result }
                : img,
            ),
          );
        }
      };
      reader.readAsDataURL(imageObj.file);
    });

    uploadImages(newImageObjects);
  };

  const uploadImages = async (imageObjects: ImageObject[]) => {
    setIsUploadingImages(true);
    try {
      const uploadPromises = imageObjects.map(async (imageObj) => {
        const uploadedId = await uploadImage(imageObj.file);
        return { tempId: imageObj.tempId, uploadedId };
      });

      const uploadResults = await Promise.all(uploadPromises);

      // Update images with their uploaded IDs
      setImages((prev) =>
        prev.map((img) => {
          const result = uploadResults.find((r) => r.tempId === img.tempId);
          return result ? { ...img, uploadedId: result.uploadedId } : img;
        }),
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "이미지 업로드에 실패했습니다",
      );
      // Remove the failed images
      const tempIds = imageObjects.map((obj) => obj.tempId);
      setImages((prev) => prev.filter((img) => !tempIds.includes(img.tempId)));
    } finally {
      setIsUploadingImages(false);
    }
  };

  const removeImage = (tempId: string) => {
    setImages((prev) => prev.filter((img) => img.tempId !== tempId));
  };

  const sendMessage = async () => {
    const uploadedImagesCount = images.filter((img) => img.uploadedId).length;
    if (
      (!newMessage.trim() && uploadedImagesCount === 0) ||
      !otherProfile ||
      isSending ||
      !currentProfile
    )
      return;

    try {
      setIsSending(true);
      const response = await client.app.messages.$post({
        query: { profile_id: currentProfile.id },
        json: {
          receiver_id: otherProfile.id,
          content: newMessage.trim(),
          image_ids: images
            .map((img) => img.uploadedId)
            .filter((id): id is string => id !== undefined),
        },
      });

      if (response.ok) {
        const result = await response.json();
        const sentMessage = {
          id: result.data.id,
          content: result.data.content,
          created_at: result.data.created_at,
          read_at: result.data.read_at,
          is_sender: result.data.is_sender,
          sender: {
            id: result.data.sender.id,
            username: result.data.sender.username,
            name: result.data.sender.name,
            profile_picture_url: result.data.sender.profile_picture_url || null,
          },
          reactions: [],
          images: result.data.images || [],
        };
        setMessages((prev) => [...prev, sentMessage]);
        setNewMessage("");
        setImages([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        setError("메시지 전송에 실패했습니다");
      }
    } catch (_err) {
      setError("메시지 전송 중 오류가 발생했습니다");
    } finally {
      setIsSending(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!currentProfile) return;

    // Find the message to validate
    const messageToDelete = messages.find((m) => m.id === messageId);
    if (!messageToDelete) {
      toast.error("메시지를 찾을 수 없습니다");
      return;
    }

    // Verify this is the user's message
    if (messageToDelete.sender.id !== currentProfile.id) {
      toast.error("자신의 메시지만 삭제할 수 있습니다");
      return;
    }

    try {
      setDeletingMessageId(messageId);

      const response = await client.app.messages[":message_id"].$delete({
        param: { message_id: messageId },
        query: { profile_id: currentProfile.id },
      });

      if (response.ok) {
        // Remove the message from the local state
        setMessages((prevMessages) =>
          prevMessages.filter((message) => message.id !== messageId),
        );
        toast.success("메시지가 삭제되었습니다");
      } else {
        // Handle API error response
        try {
          const errorData = await response.json();
          toast.error(
            getErrorMessage(errorData, "메시지를 삭제할 수 없습니다"),
          );
        } catch {
          toast.error("메시지를 삭제할 수 없습니다");
        }
      }
    } catch (_error) {
      toast.error("메시지 삭제 중 오류가 발생했습니다");
    } finally {
      setDeletingMessageId(null);
      setConfirmDeleteMessageId(null);
    }
  };

  const handleDeleteClick = (messageId: string) => {
    setConfirmDeleteMessageId(messageId);
  };

  const confirmDelete = () => {
    if (confirmDeleteMessageId) {
      deleteMessage(confirmDeleteMessageId);
    }
  };

  const cancelDelete = () => {
    setConfirmDeleteMessageId(null);
  };

  const addReaction = async (messageId: string, emoji: string) => {
    if (!currentProfile) return;

    try {
      const response = await client.app.messages[":message_id"].reactions.$post(
        {
          param: { message_id: messageId },
          json: {
            profile_id: currentProfile.id,
            emoji: emoji,
          },
        },
      );

      if (response.ok) {
        // Refresh messages to get updated reactions
        if (otherProfile) {
          const messagesResponse = await client.app.conversations[
            ":other_profile_id"
          ].$get({
            param: { other_profile_id: otherProfile.id },
            query: { profile_id: currentProfile.id },
          });
          if (messagesResponse.ok) {
            const messagesResult = await messagesResponse.json();
            // Transform API response to match Message interface
            const transformedMessages: Message[] = messagesResult.data.map(
              (message: {
                id: string;
                content: string;
                created_at: string;
                read_at: string | null;
                is_sender: boolean;
                sender: {
                  id: string;
                  username: string;
                  name: string;
                  profile_picture_url: string | null;
                };
                reactions: Array<{
                  emoji: string;
                  user: { id: string; username: string; name: string };
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
                read_at: message.read_at,
                is_sender: message.is_sender,
                sender: {
                  id: message.sender.id,
                  username: message.sender.username,
                  name: message.sender.name,
                  profile_picture_url: message.sender.profile_picture_url,
                },
                reactions: message.reactions,
                images: message.images,
              }),
            );
            setMessages(transformedMessages.reverse());
          }
        }
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
  };

  const removeReaction = async (messageId: string, emoji: string) => {
    if (!currentProfile) return;

    try {
      const response = await client.app.messages[
        ":message_id"
      ].reactions.$delete({
        param: { message_id: messageId },
        query: {
          profile_id: currentProfile.id,
          emoji: emoji,
        },
      });

      if (response.ok) {
        // Refresh messages to get updated reactions
        if (otherProfile) {
          const messagesResponse = await client.app.conversations[
            ":other_profile_id"
          ].$get({
            param: { other_profile_id: otherProfile.id },
            query: { profile_id: currentProfile.id },
          });
          if (messagesResponse.ok) {
            const messagesResult = await messagesResponse.json();
            const transformedMessages: Message[] = messagesResult.data.map(
              (message: {
                id: string;
                content: string;
                created_at: string;
                read_at: string | null;
                is_sender: boolean;
                sender: {
                  id: string;
                  username: string;
                  name: string;
                  profile_picture_url: string | null;
                };
                reactions: Array<{
                  emoji: string;
                  user: { id: string; username: string; name: string };
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
                read_at: message.read_at,
                is_sender: message.is_sender,
                sender: {
                  id: message.sender.id,
                  username: message.sender.username,
                  name: message.sender.name,
                  profile_picture_url: message.sender.profile_picture_url,
                },
                reactions: message.reactions,
                images: message.images,
              }),
            );
            setMessages(transformedMessages.reverse());
          }
        }
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
  };

  const formatTime = (createdAt: string) => {
    const date = new Date(createdAt);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (createdAt: string) => {
    const date = new Date(createdAt);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return "오늘";
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isYesterday) {
      return "어제";
    }

    return date.toLocaleDateString("ko-KR");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
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
              <MessageCircle className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">
              로그인이 필요합니다
            </h1>
            <p className="text-muted-foreground mb-6">
              메시지를 확인하려면 로그인해주세요.
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
                대화를 불러오는 중...
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
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
              to="/messages"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              메시지 목록으로
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
                메시지
              </Link>
              {otherProfile && (
                <div className="flex items-center gap-3">
                  <ProfileAvatar
                    profilePictureUrl={
                      otherProfile.profile_picture_url || undefined
                    }
                    name={otherProfile.name}
                    username={otherProfile.username}
                    size="md"
                    className="border-2 border-border"
                  />
                  <div>
                    <h1 className="font-bold text-foreground">
                      {otherProfile.name}
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      @{otherProfile.username}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full max-w-4xl mx-auto px-4 py-6 flex flex-col">
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto space-y-4 mb-6 relative"
          >
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <MessageCircle />
                    </EmptyMedia>
                    <EmptyTitle>아직 메시지가 없습니다</EmptyTitle>
                    <EmptyDescription>첫 메시지를 보내보세요!</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            ) : (
              messages
                .sort((a, b) => a.created_at.localeCompare(b.created_at))
                .map((message, index) => {
                  const prevMessage = messages[index - 1];
                  const showDate =
                    index === 0 ||
                    !prevMessage ||
                    formatDate(message.created_at) !==
                      formatDate(prevMessage.created_at);

                  return (
                    <div key={message.id}>
                      {showDate && (
                        <div className="text-center my-4">
                          <span className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">
                            {formatDate(message.created_at)}
                          </span>
                        </div>
                      )}

                      <div
                        className={`flex ${
                          message.sender.id === currentProfile?.id
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <MessageBubble
                          content={message.content}
                          timestamp={formatTime(message.created_at)}
                          isFromMe={message.sender.id === currentProfile?.id}
                          images={message.images}
                          currentProfileId={currentProfile?.id}
                        >
                          <DirectMessageReactions
                            reactions={message.reactions || []}
                            currentProfileId={currentProfile?.id}
                            onAddReaction={(emoji) =>
                              addReaction(message.id, emoji)
                            }
                            onRemoveReaction={(emoji) =>
                              removeReaction(message.id, emoji)
                            }
                            onDelete={
                              message.sender.id === currentProfile?.id
                                ? () => handleDeleteClick(message.id)
                                : undefined
                            }
                            isDeleting={deletingMessageId === message.id}
                            isFromMe={message.sender.id === currentProfile?.id}
                          />
                        </MessageBubble>
                      </div>
                    </div>
                  );
                })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            {/* Image previews */}
            {images.length > 0 && (
              <div className="mb-3 pb-3 border-b border-border">
                <div className="flex flex-wrap gap-2">
                  {images.map((image) => (
                    <div key={image.tempId} className="relative group">
                      <img
                        src={image.preview}
                        alt="Preview"
                        className="w-16 h-16 object-cover rounded-lg border border-border"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(image.tempId)}
                        disabled={isUploadingImages || isSending}
                        className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
                        title="이미지 제거"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      {isUploadingImages && !image.uploadedId && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                          <div className="text-white text-xs font-medium">
                            업로드 중...
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImages || isSending}
                className="flex-shrink-0 w-10 h-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                title="이미지 첨부"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="메시지를 입력하세요..."
                className="flex-1 resize-none border-0 focus:ring-0 p-0 text-sm placeholder-gray-500 max-h-32"
                rows={1}
                disabled={isSending}
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={
                  (!newMessage.trim() &&
                    images.filter((img) => img.uploadedId).length === 0) ||
                  isSending ||
                  isUploadingImages
                }
                className="flex-shrink-0 w-10 h-10 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {confirmDeleteMessageId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  메시지 삭제
                </h3>
                <p className="text-sm text-muted-foreground">
                  이 작업은 되돌릴 수 없습니다
                </p>
              </div>
            </div>
            <p className="text-foreground mb-6">
              정말로 이 메시지를 삭제하시겠습니까?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={cancelDelete}
                disabled={deletingMessageId !== null}
                className="px-4 py-2 text-foreground bg-accent hover:bg-muted rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deletingMessageId !== null}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deletingMessageId ? (
                  <>
                    <Spinner className="h-4 w-4 text-white" />
                    삭제 중...
                  </>
                ) : (
                  "삭제"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
