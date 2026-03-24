import { Clock } from "lucide-react";
import { useState } from "react";
import { PostPreview } from "./PostPreview";
import { ImageModal } from "./post/ImageModal";

interface MessageBubbleProps {
  content: string;
  timestamp: string;
  isFromMe: boolean;
  senderName?: string;
  senderAvatar?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
  hasReactions?: boolean;
  currentProfileId?: string;
  images?: Array<{
    id: string;
    url: string;
    width: number;
    height: number;
  }>;
}

export function MessageBubble({
  content,
  timestamp,
  isFromMe,
  senderName,
  senderAvatar,
  children,
  onClick,
  hasReactions = false,
  currentProfileId,
  images,
}: MessageBubbleProps) {
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    filename: string;
  } | null>(null);

  // Detect post URLs in the content
  // Pattern matches: /username/post_id or https://domain/username/post_id
  const postUrlPattern = /(https?:\/\/[^\s]+)?\/([^/\s]+)\/([a-f0-9-]{36})/gi;
  const postUrls = content.match(postUrlPattern) || [];

  // Extract content without URLs for display
  const contentWithoutUrls = content.replace(postUrlPattern, "").trim();

  return (
    <div
      className={`flex flex-col ${isFromMe ? "items-end" : "items-start"} max-w-xs lg:max-w-md`}
    >
      {/* Sender info for messages from others */}
      {!isFromMe && senderAvatar && (
        <div className="flex items-center gap-2 mb-1">
          {senderAvatar}
          {senderName && (
            <span className="text-sm font-medium text-foreground">
              {senderName}
            </span>
          )}
        </div>
      )}

      {/* Post Previews - shown above message */}
      {postUrls.length > 0 && (
        <div className="w-full mb-2">
          {postUrls.map((url) => (
            <PostPreview
              key={url}
              postUrl={url}
              currentProfileId={currentProfileId}
            />
          ))}
        </div>
      )}

      {/* Message bubble */}
      {(contentWithoutUrls || (images && images.length > 0)) && (
        <div
          {...(onClick && {
            onClick,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            },
            role: "button" as const,
            tabIndex: 0,
          })}
          className={`rounded-lg px-4 py-2 ${
            isFromMe ? "bg-blue-600 text-white" : "bg-accent text-foreground"
          } ${hasReactions && onClick ? "cursor-pointer hover:opacity-90" : ""}`}
        >
          {/* Images */}
          {images && images.length > 0 && (
            <div className={`flex flex-col gap-2 ${content ? "mb-2" : ""}`}>
              {images.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImage({
                      url: image.url,
                      filename: `image-${image.id}`,
                    });
                  }}
                  className="cursor-pointer"
                >
                  <img
                    src={image.url}
                    alt="Attached"
                    width={image.width}
                    height={image.height}
                    className="rounded-md w-full h-auto object-cover"
                    style={{ maxHeight: "300px", minWidth: "200px" }}
                  />
                </button>
              ))}
            </div>
          )}
          {/* Content */}
          {contentWithoutUrls && (
            <p className="text-sm whitespace-pre-wrap">{contentWithoutUrls}</p>
          )}
        </div>
      )}

      {/* Timestamp, reactions, and actions */}
      <div className="flex flex-wrap items-center gap-1 mt-1">
        {!isFromMe && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mr-1">
            <Clock className="h-3 w-3" />
            {timestamp}
          </span>
        )}
        {children}
        {isFromMe && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground ml-1">
            <Clock className="h-3 w-3" />
            {timestamp}
          </span>
        )}
      </div>

      {/* Image Modal */}
      <ImageModal
        image={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
}
