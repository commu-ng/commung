import { useRef, useState } from "react";
import MarkdownIt from "markdown-it";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ImageIcon } from "lucide-react";
import { MarkdownHelpModal } from "~/components/MarkdownHelpModal";

const md = new MarkdownIt({ linkify: true, breaks: true });

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onImageUpload?: (file: File) => Promise<{ url: string; id: string }>;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "마크다운으로 내용을 작성하세요...",
  disabled = false,
  onImageUpload,
}: MarkdownEditorProps) {
  const [showHelp, setShowHelp] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !onImageUpload) return;

    try {
      setIsUploading(true);
      const { url } = await onImageUpload(file);

      // Insert markdown image syntax at cursor position
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const beforeCursor = value.substring(0, start);
        const afterCursor = value.substring(end);
        const imageMarkdown = `![](${url})`;
        const newContent = beforeCursor + imageMarkdown + afterCursor;
        onChange(newContent);

        // Set cursor position after inserted image
        setTimeout(() => {
          const newPosition = start + imageMarkdown.length;
          textarea.setSelectionRange(newPosition, newPosition);
          textarea.focus();
        }, 0);
      }
    } catch (error) {
      console.error("Image upload failed:", error);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const renderMarkdown = () => {
    try {
      return md.render(value);
    } catch (error) {
      return `<p class="text-destructive">마크다운 렌더링 오류: ${error instanceof Error ? error.message : "알 수 없는 오류"}</p>`;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">내용</div>
        {onImageUpload && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleImageButtonClick}
              disabled={disabled || isUploading}
              className="h-8"
            >
              <ImageIcon className="h-4 w-4 mr-1" />
              {isUploading ? "업로드 중..." : "이미지 삽입"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              disabled={disabled}
            />
          </>
        )}
      </div>

      <Tabs defaultValue="edit" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="edit">편집</TabsTrigger>
          <TabsTrigger value="preview">미리보기</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-2">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="min-h-[300px] font-mono text-sm"
          />

          <p className="text-xs text-muted-foreground">
            팁:{" "}
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="text-primary hover:text-primary/90 underline"
            >
              마크다운
            </button>{" "}
            문법을 사용하여 내용을 작성할 수 있습니다
          </p>
        </TabsContent>

        <TabsContent value="preview">
          <div className="min-h-[300px] border rounded-md p-4 bg-muted/10">
            {value.trim() ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown is sanitized by markdown-it
                dangerouslySetInnerHTML={{ __html: renderMarkdown() }}
              />
            ) : (
              <p className="text-muted-foreground text-center py-12">
                아직 미리 볼 내용이 없습니다. 편집 탭에서 작성을 시작하세요.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <MarkdownHelpModal open={showHelp} onOpenChange={setShowHelp} />
    </div>
  );
}
