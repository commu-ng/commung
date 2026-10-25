import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  LogIn,
  Shield,
  UserCog,
  Users,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { PageHeader } from "~/components/shared/PageHeader";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useAuth } from "~/hooks/useAuth";
import { api, getErrorMessage } from "~/lib/api-client";
import type { Route } from "./+types/admin.masquerade";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "사용자 전환" },
    { name: "description", content: "관리자 사용자 전환 기능" },
  ];
}

interface OwnedCommunity {
  id: string;
  name: string;
  slug: string;
}

interface User {
  id: string;
  login_name: string;
  email: string | null;
  created_at: string;
  is_admin: boolean;
  owned_communities: OwnedCommunity[];
}

async function fetchUsers(search?: string): Promise<User[]> {
  const res = await api.console.admin.masquerade.users.$get({
    query: search ? { search } : {},
  });
  if (!res.ok) {
    throw new Error("Failed to fetch users");
  }
  const data = await res.json();
  if ("data" in data && "users" in data.data) {
    return data.data.users;
  }
  return [];
}

export default function AdminMasquerade() {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [communityOwnersOnly, setCommunityOwnersOnly] = useState(false);
  const communityOwnersCheckboxId = useId();

  // Debounce search query to prevent API calls on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const {
    data: users,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin", "masquerade", "users", debouncedSearch],
    queryFn: () => fetchUsers(debouncedSearch),
    enabled: isAuthenticated,
  });

  const filteredUsers = communityOwnersOnly
    ? users?.filter((u) => u.owned_communities.length > 0)
    : users;

  const startMasqueradeMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const res = await api.console.admin.masquerade.start.$post({
        json: {
          target_user_id: targetUserId,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, "전환 시작에 실패했습니다"));
      }

      return await res.json();
    },
    onSuccess: (data) => {
      toast.success(
        `${data.data.target_user.login_name} 사용자로 전환되었습니다`,
      );
      // Invalidate queries and reload
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      queryClient.invalidateQueries({ queryKey: ["masquerade"] });
      // Reload to reflect the masquerade session
      window.location.href = "/";
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleMasquerade = (targetUser: User) => {
    if (
      window.confirm(
        `${targetUser.login_name} 사용자로 전환하시겠습니까?\n\n전환 중에는 비밀번호 변경, 이메일 변경, 계정 삭제와 같은 민감한 작업이 제한됩니다.`,
      )
    ) {
      startMasqueradeMutation.mutate(targetUser.id);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center bg-background py-12">
        <div className="text-center space-y-6">
          <h1 className="text-2xl font-bold">로그인이 필요합니다</h1>
          <div className="flex gap-4">
            <Button asChild>
              <Link to="/login">로그인</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!user?.is_admin) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircle />
            </EmptyMedia>
            <EmptyTitle>접근 권한 없음</EmptyTitle>
            <EmptyDescription>
              관리자만 이 페이지에 접근할 수 있습니다
            </EmptyDescription>
          </EmptyHeader>
          <Button asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              홈으로 돌아가기
            </Link>
          </Button>
        </Empty>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircle />
            </EmptyMedia>
            <EmptyTitle>오류 발생</EmptyTitle>
            <EmptyDescription>
              사용자 목록을 불러올 수 없습니다
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => refetch()}>다시 시도</Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <PageHeader
        eyebrow="관리자"
        icon={UserCog}
        title="사용자 전환"
        description="다른 계정으로 전환해 디버깅해요"
        tone="butter"
      />

      <div className="bg-butter/40 border border-butter/60 rounded-lg p-4 mb-6 flex gap-3">
        <Shield className="h-5 w-5 text-butter-ink flex-shrink-0 mt-0.5" />
        <div className="text-sm text-butter-ink">
          <p className="font-semibold mb-1">보안 안내</p>
          <ul className="list-disc list-inside space-y-1">
            <li>모든 전환 활동은 감사 로그에 기록됩니다</li>
            <li>
              전환 중에는 비밀번호 변경, 이메일 변경, 계정 삭제가 제한됩니다
            </li>
            <li>전환을 종료하면 자동으로 관리자 계정으로 돌아갑니다</li>
          </ul>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              전체 사용자 ({filteredUsers?.length || 0}명)
            </span>
          </CardTitle>
          <div className="mt-4 flex items-center gap-4">
            <Input
              type="text"
              placeholder="사용자 검색 (로그인 이름, 이메일, 또는 UUID)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
            <div className="flex items-center gap-2 text-sm whitespace-nowrap">
              <Checkbox
                id={communityOwnersCheckboxId}
                checked={communityOwnersOnly}
                onCheckedChange={(checked) =>
                  setCommunityOwnersOnly(checked === true)
                }
              />
              <label
                htmlFor={communityOwnersCheckboxId}
                className="cursor-pointer"
              >
                커뮤니티 소유자만
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isFetching && (
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              검색 중...
            </div>
          )}
          {!filteredUsers || filteredUsers.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>사용자가 없습니다</EmptyTitle>
                <EmptyDescription>
                  {searchQuery
                    ? "검색 조건에 맞는 사용자가 없습니다"
                    : "전환 가능한 사용자가 없습니다"}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>로그인 이름</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead>소유 커뮤니티</TableHead>
                  <TableHead>가입일</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((targetUser) => (
                  <TableRow key={targetUser.id}>
                    <TableCell className="font-medium">
                      {targetUser.login_name}
                    </TableCell>
                    <TableCell>{targetUser.email || "-"}</TableCell>
                    <TableCell>
                      {targetUser.is_admin ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-butter-ink bg-butter/40 px-2 py-1 rounded">
                          <Shield className="h-3 w-3" />
                          관리자
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          일반 사용자
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {targetUser.owned_communities.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {targetUser.owned_communities.map((c) => (
                            <Badge key={c.id} variant="secondary">
                              {c.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(targetUser.created_at).toLocaleDateString(
                        "ko-KR",
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMasquerade(targetUser)}
                        disabled={startMasqueradeMutation.isPending}
                      >
                        <LogIn className="h-4 w-4 mr-2" />
                        전환
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
