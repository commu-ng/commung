import { useId, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { api, getErrorMessage } from "~/lib/api-client";

interface MuteProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  profileName: string;
  communityId: string;
  onSuccess: () => void;
}

export function MuteProfileDialog({
  isOpen,
  onClose,
  profileId,
  profileName,
  communityId,
  onSuccess,
}: MuteProfileDialogProps) {
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [isMuting, setIsMuting] = useState(false);
  const [error, setError] = useState("");

  const handleMute = async () => {
    setIsMuting(true);
    setError("");

    try {
      const response = await api.console.communities[":id"].profiles[
        ":profileId"
      ].mute.$post({
        param: { id: communityId, profileId },
        json: { reason: reason.trim() || undefined },
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = getErrorMessage(
          errorData,
          "프로필 음소거에 실패했습니다",
        );
        setError(errorMessage);
        return;
      }

      toast.success("프로필이 성공적으로 음소거되었습니다");
      setReason("");
      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "프로필 음소거에 실패했습니다",
      );
    } finally {
      setIsMuting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>프로필 음소거</DialogTitle>
          <DialogDescription>
            <strong>{profileName}</strong> 프로필을 음소거하시겠습니까? 음소거된
            프로필은 게시물을 작성할 수 없습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={reasonId}>사유 (선택)</Label>
            <Textarea
              id={reasonId}
              placeholder="음소거 사유를 입력하세요..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              disabled={isMuting}
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 dark:bg-destructive/20 p-2 rounded">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isMuting}>
            취소
          </Button>
          <Button
            onClick={handleMute}
            disabled={isMuting}
            className="bg-mute-strong text-white hover:bg-mute-strong-hover"
          >
            {isMuting ? "음소거 중..." : "음소거"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface UnmuteProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  profileName: string;
  communityId: string;
  onSuccess: () => void;
}

export function UnmuteProfileDialog({
  isOpen,
  onClose,
  profileId,
  profileName,
  communityId,
  onSuccess,
}: UnmuteProfileDialogProps) {
  const [isUnmuting, setIsUnmuting] = useState(false);
  const [error, setError] = useState("");

  const handleUnmute = async () => {
    setIsUnmuting(true);
    setError("");

    try {
      const response = await api.console.communities[":id"].profiles[
        ":profileId"
      ].mute.$delete({
        param: { id: communityId, profileId },
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = getErrorMessage(
          errorData,
          "프로필 음소거 해제에 실패했습니다",
        );
        setError(errorMessage);
        return;
      }

      toast.success("프로필 음소거가 성공적으로 해제되었습니다");
      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "프로필 음소거 해제에 실패했습니다",
      );
    } finally {
      setIsUnmuting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>음소거 해제</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{profileName}</strong> 프로필의 음소거를 해제하시겠습니까?
            해제 후 다시 게시물을 작성할 수 있습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 dark:bg-destructive/20 p-2 rounded">
            {error}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isUnmuting}>취소</AlertDialogCancel>
          <AlertDialogAction onClick={handleUnmute} disabled={isUnmuting}>
            {isUnmuting ? "해제 중..." : "해제"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
