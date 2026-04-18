import {
  MoreVertical,
  Shield,
  UserMinus,
  VolumeX,
  Volume2,
} from "lucide-react";
import { useState } from "react";
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
import { Card, CardContent } from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { api, getErrorMessage } from "~/lib/api-client";
import { canModifyMember, canRemoveMember } from "~/lib/role-utils";
import type { CommunityMember } from "~/types/member";
import { MuteProfileDialog, UnmuteProfileDialog } from "./MuteProfileDialog";
import { RoleUpdateDialog } from "./RoleUpdateDialog";
import { type Role, RoleBadge } from "./shared/RoleBadge";
import { Badge } from "./ui/badge";

interface MemberCardProps {
  member: CommunityMember;
  communityId: string;
  currentUserRole: Role;
  currentUserId: string;
  onMemberUpdate: () => void;
}

export function MemberCard({
  member,
  communityId,
  currentUserRole,
  currentUserId: _currentUserId,
  onMemberUpdate,
}: MemberCardProps) {
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [showMuteDialog, setShowMuteDialog] = useState(false);
  const [showUnmuteDialog, setShowUnmuteDialog] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState("");

  const isCurrentUser = member.is_current_user;

  // Check permissions using role utilities
  const canModify = canModifyMember(currentUserRole, member.role);
  const canRemove = canRemoveMember(currentUserRole, member.role);

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

  const getInitial = () => {
    const displayName = getDisplayName();
    return displayName.charAt(0).toUpperCase();
  };

  const displayName = getDisplayName();

  // Use utility functions for permission checks
  const canChangeRole = canModify && member.role !== "owner";
  const _canRemoveOther = canRemove && !isCurrentUser;

  // Allow self-removal for non-owners
  const canLeave = isCurrentUser && member.role !== "owner";

  // Can mute/unmute if owner or moderator (but not self)
  const canModerateProfiles =
    (currentUserRole === "owner" || currentUserRole === "moderator") &&
    !isCurrentUser;

  const handleMuteProfile = (profileId: string, profileName: string) => {
    setSelectedProfile({ id: profileId, name: profileName });
    setShowMuteDialog(true);
  };

  const handleUnmuteProfile = (profileId: string, profileName: string) => {
    setSelectedProfile({ id: profileId, name: profileName });
    setShowUnmuteDialog(true);
  };

  const handleRemoveMember = async () => {
    setIsRemoving(true);
    setError("");

    try {
      // If removing self, use the leave endpoint
      const response = isCurrentUser
        ? await api.console.communities[":id"].leave.$delete({
            param: { id: communityId },
          })
        : await api.console.communities[":id"].members[
            ":membership_id"
          ].$delete({
            param: { id: communityId, membership_id: member.id },
          });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = getErrorMessage(
          errorData,
          isCurrentUser
            ? "커뮤 나가기에 실패했습니다"
            : "멤버 제거에 실패했습니다",
        );
        toast.error(errorMessage);
        return;
      }

      onMemberUpdate();
      setShowRemoveDialog(false);

      if (isCurrentUser) {
        toast.success("커뮤에서 나갔습니다");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isCurrentUser
            ? "커뮤 나가기에 실패했습니다"
            : "멤버 제거에 실패했습니다",
      );
    } finally {
      setIsRemoving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Generate a consistent color for the group border based on user_group
  const getGroupBorderColor = (userGroup: string | undefined) => {
    if (!userGroup) return "";

    // Hash the UUID to get a consistent color
    const hash = userGroup.split("").reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);

    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  };

  const groupBorderStyle = member.user_group
    ? {
        borderLeft: `4px solid ${getGroupBorderColor(member.user_group)}`,
        borderRadius: "0.5rem",
      }
    : {};

  return (
    <>
      <Card style={groupBorderStyle}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                {getInitial()}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{displayName}</h3>
                  {isCurrentUser && (
                    <Badge variant="outline" className="text-xs">
                      나
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <RoleBadge role={member.role} />
                  <span className="text-xs text-muted-foreground">
                    가입일: {formatDate(member.created_at)}
                  </span>
                </div>

                {/* Profile Information */}
                {member.profiles.length > 0 ? (
                  <div className="mt-2">
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      활성 프로필:
                      {member.user_group && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (다중 프로필 사용자)
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {member.profiles.map((profile) => (
                        <div
                          key={profile.id}
                          className="flex items-center gap-1"
                        >
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              profile.primary
                                ? "border-primary"
                                : "border-muted"
                            } ${profile.muted_at ? "bg-mute/15 border-mute/40" : ""}`}
                          >
                            {profile.muted_at && (
                              <VolumeX className="w-3 h-3 mr-1 text-mute" />
                            )}
                            {profile.name} (@{profile.username})
                            {profile.primary && " ★"}
                          </Badge>
                          {canModerateProfiles && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                >
                                  <MoreVertical className="w-3 h-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                {profile.muted_at ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleUnmuteProfile(
                                        profile.id,
                                        profile.name,
                                      )
                                    }
                                  >
                                    <Volume2 className="w-4 h-4 mr-2" />
                                    음소거 해제
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleMuteProfile(
                                        profile.id,
                                        profile.name,
                                      )
                                    }
                                    className="text-mute"
                                  >
                                    <VolumeX className="w-4 h-4 mr-2" />
                                    음소거
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : member.application ? (
                  <div className="mt-2">
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      신청 정보:
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {member.application.profile_name} (@
                      {member.application.profile_username})
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-2">
                      상태: {member.application.status}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {(canChangeRole || canRemove || canLeave) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canChangeRole && (
                    <DropdownMenuItem onClick={() => setShowRoleDialog(true)}>
                      <Shield className="w-4 h-4 mr-2" />
                      역할 변경
                    </DropdownMenuItem>
                  )}
                  {canRemove && (
                    <DropdownMenuItem
                      onClick={() => setShowRemoveDialog(true)}
                      className="text-destructive"
                    >
                      <UserMinus className="w-4 h-4 mr-2" />
                      멤버 제거
                    </DropdownMenuItem>
                  )}
                  {canLeave && (
                    <DropdownMenuItem
                      onClick={() => setShowRemoveDialog(true)}
                      className="text-destructive"
                    >
                      <UserMinus className="w-4 h-4 mr-2" />
                      커뮤 나가기
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {error && (
            <div className="mt-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      <RoleUpdateDialog
        isOpen={showRoleDialog}
        onClose={() => setShowRoleDialog(false)}
        member={member}
        communityId={communityId}
        currentUserRole={currentUserRole}
        onSuccess={onMemberUpdate}
      />

      {selectedProfile && (
        <>
          <MuteProfileDialog
            isOpen={showMuteDialog}
            onClose={() => {
              setShowMuteDialog(false);
              setSelectedProfile(null);
            }}
            profileId={selectedProfile.id}
            profileName={selectedProfile.name}
            communityId={communityId}
            onSuccess={onMemberUpdate}
          />

          <UnmuteProfileDialog
            isOpen={showUnmuteDialog}
            onClose={() => {
              setShowUnmuteDialog(false);
              setSelectedProfile(null);
            }}
            profileId={selectedProfile.id}
            profileName={selectedProfile.name}
            communityId={communityId}
            onSuccess={onMemberUpdate}
          />
        </>
      )}

      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isCurrentUser ? "커뮤 나가기" : "멤버 제거"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isCurrentUser ? (
                <>
                  정말로 이 커뮤에서 나가시겠습니까? 다시 가입하려면 재신청이
                  필요합니다.
                </>
              ) : (
                <>
                  정말로 <strong>{displayName}</strong>님을 커뮤에서
                  제거하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={isRemoving}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isRemoving
                ? isCurrentUser
                  ? "나가는 중..."
                  : "제거 중..."
                : isCurrentUser
                  ? "나가기"
                  : "제거"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
