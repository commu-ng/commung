import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { ArrowLeft, Ban, UserMinus } from "lucide-react";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { LoadingState } from "~/components/shared/LoadingState";
import { PageHeader } from "~/components/shared/PageHeader";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useAuth } from "~/hooks/useAuth";
import { api, getErrorMessage } from "~/lib/api-client";
import type { Route } from "./+types/account.blocked-users";

interface BlockedUser {
  id: string;
  login_name: string;
  blocked_at: string;
}

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "차단한 사용자" },
    { name: "description", content: "차단한 사용자 관리" },
  ];
}

export default function BlockedUsers() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isLoading: isAuthLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      navigate(`/login?next=${encodeURIComponent("/account/blocked-users")}`);
    }
  }, [isAuthLoading, isAuthenticated, navigate]);

  const { data: blockedUsers, isLoading } = useQuery({
    queryKey: ["blocked-users"],
    queryFn: async () => {
      const res = await api.console.blocks.$get();
      if (!res.ok) throw new Error("Failed to fetch blocked users");
      const json = await res.json();
      return json.data as BlockedUser[];
    },
    enabled: isAuthenticated,
  });

  const unblockMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await api.console.blocks[":user_id"].$delete({
        param: { user_id: userId },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, "차단 해제에 실패했습니다"));
      }
    },
    onSuccess: () => {
      toast.success("사용자 차단이 해제되었습니다");
      queryClient.invalidateQueries({ queryKey: ["blocked-users"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (isAuthLoading || isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <LoadingState message="차단한 사용자를 불러오는 중..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/account">
            <ArrowLeft className="h-4 w-4 mr-2" />
            계정 설정
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow="계정 설정"
        icon={Ban}
        title="차단한 사용자"
        description="차단을 풀거나 목록을 확인해요"
        tone="primary"
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>차단 목록</CardTitle>
            <CardDescription>
              차단한 사용자의 게시글과 댓글은 게시판에서 보이지 않습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {blockedUsers?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserMinus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">차단한 사용자가 없습니다</p>
                <p className="text-sm mt-1">
                  사용자 프로필에서 차단할 수 있습니다.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {blockedUsers?.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{user.login_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(user.blocked_at), "yyyy년 MM월 dd일", {
                          locale: ko,
                        })}
                        에 차단
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unblockMutation.mutate(user.id)}
                      disabled={unblockMutation.isPending}
                    >
                      <UserMinus className="h-4 w-4 mr-2" />
                      차단 해제
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
