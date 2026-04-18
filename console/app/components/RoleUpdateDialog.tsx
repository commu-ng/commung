import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api, getErrorMessage } from "~/lib/api-client";
import type { CommunityMember } from "~/types/member";

interface RoleUpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  member: CommunityMember;
  communityId: string;
  currentUserRole: "owner" | "moderator" | "member";
  onSuccess: () => void;
}

const ROLE_LABELS = {
  owner: "소유자",
  moderator: "모더레이터",
  member: "멤버",
} as const;

const ROLE_DESCRIPTIONS = {
  owner: "커뮤의 모든 권한을 가집니다",
  moderator: "멤버 관리 및 게시물 삭제 권한을 가집니다",
  member: "기본 멤버 권한을 가집니다",
} as const;

const ROLE_COLORS = {
  owner: "bg-destructive/15 text-destructive",
  moderator: "bg-primary/15 text-primary",
  member: "bg-muted text-muted-foreground",
} as const;

export function RoleUpdateDialog({
  isOpen,
  onClose,
  member,
  communityId,
  currentUserRole,
  onSuccess,
}: RoleUpdateDialogProps) {
  const [selectedRole, setSelectedRole] = useState<
    "owner" | "moderator" | "member"
  >(member.role);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Helper to get display name from profiles or fallback to application
  const getDisplayName = () => {
    if (member.profiles.length > 0) {
      const primaryProfile =
        member.profiles.find((profile) => profile.primary) ||
        member.profiles[0];
      if (primaryProfile) {
        return primaryProfile.name || primaryProfile.username;
      }
    }
    if (member.application) {
      return (
        member.application.profile_name || member.application.profile_username
      );
    }
    return "Unknown Member";
  };

  const displayName = getDisplayName();

  const canChangeRole =
    (currentUserRole === "owner" || currentUserRole === "moderator") &&
    member.role !== "owner";
  const availableRoles: Array<"owner" | "moderator" | "member"> = (() => {
    if (currentUserRole === "owner") {
      return ["owner", "moderator", "member"];
    } else if (currentUserRole === "moderator") {
      return ["moderator", "member"];
    }
    return [];
  })();

  const handleSubmit = async () => {
    if (selectedRole === member.role) {
      onClose();
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await api.console.communities[":id"].members.role.$put({
        param: { id: communityId },
        json: {
          membership_id: member.id,
          role: selectedRole,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = getErrorMessage(
          errorData,
          "역할 변경에 실패했습니다",
        );
        toast.error(errorMessage);
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "역할 변경에 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setSelectedRole(member.role);
      setError("");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>멤버 역할 변경</DialogTitle>
          <DialogDescription>
            {displayName}님의 역할을 변경합니다
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">현재 역할:</span>
            <Badge className={ROLE_COLORS[member.role]}>
              {ROLE_LABELS[member.role]}
            </Badge>
          </div>

          {canChangeRole ? (
            <div className="space-y-2">
              <div className="text-sm font-medium">새 역할:</div>
              <Select
                value={selectedRole}
                onValueChange={(value) => {
                  if (
                    value === "owner" ||
                    value === "moderator" ||
                    value === "member"
                  ) {
                    setSelectedRole(value);
                  }
                }}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      <div className="flex items-center gap-2">
                        <Badge className={ROLE_COLORS[role]} variant="outline">
                          {ROLE_LABELS[role]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {ROLE_DESCRIPTIONS[role]}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {member.role === "owner"
                ? "소유자의 역할은 변경할 수 없습니다"
                : "역할을 변경할 권한이 없습니다"}
            </div>
          )}

          {selectedRole !== member.role && (
            <div className="p-3 bg-butter/40 border border-butter/60 rounded-md">
              <p className="text-sm text-butter-ink">
                <strong>{displayName}</strong>님의 역할이{" "}
                <strong>{ROLE_LABELS[member.role]}</strong>에서{" "}
                <strong>{ROLE_LABELS[selectedRole]}</strong>로 변경됩니다.
              </p>
              {selectedRole === "owner" && (
                <p className="text-xs text-butter-ink mt-1">
                  ⚠️ 소유자 권한을 양도하면 되돌릴 수 없습니다.
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/15 p-2 rounded">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            취소
          </Button>
          {canChangeRole && selectedRole !== member.role && (
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              variant={selectedRole === "owner" ? "destructive" : "default"}
            >
              {isLoading && <Spinner />}
              {isLoading ? "변경 중..." : "역할 변경"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
