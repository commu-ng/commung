import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpDown,
  ExternalLink,
  Globe,
  Loader2,
  LogIn,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
import { env } from "~/lib/env";
import type { Route } from "./+types/admin.communities";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "커뮤니티 관리" },
    { name: "description", content: "전체 커뮤니티 목록 및 활동 현황" },
  ];
}

type SortOption = "activity" | "members" | "created";

interface Community {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  starts_at: string;
  ends_at: string;
  is_recruiting: boolean;
  member_count: number;
  post_count: number;
  owner_user_id: string | null;
  owner_login_name: string | null;
}

async function fetchCommunities(
  sort: SortOption,
  days: number,
): Promise<{ communities: Community[]; days: number }> {
  const res = await api.console.admin.communities.$get({
    query: { sort, days: String(days) },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch communities");
  }
  const data = await res.json();
  if ("data" in data) {
    return data.data;
  }
  return { communities: [], days };
}

export default function AdminCommunities() {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<SortOption>("activity");
  const [days, setDays] = useState(30);

  const masqueradeMutation = useMutation({
    mutationFn: async ({
      targetUserId,
      communitySlug,
    }: {
      targetUserId: string;
      communitySlug: string;
    }) => {
      const res = await api.console.admin.masquerade.start.$post({
        json: { target_user_id: targetUserId },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, "전환 시작에 실패했습니다"));
      }
      return { communitySlug };
    },
    onSuccess: ({ communitySlug }) => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      queryClient.invalidateQueries({ queryKey: ["masquerade"] });
      window.location.href = `https://${communitySlug}.${env.domain}`;
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleMasqueradeAndOpen = (community: Community) => {
    if (!community.owner_user_id) return;
    if (
      window.confirm(
        `${community.owner_login_name} 사용자로 전환하고 ${community.name} 앱을 열겠습니까?`,
      )
    ) {
      masqueradeMutation.mutate({
        targetUserId: community.owner_user_id,
        communitySlug: community.slug,
      });
    }
  };

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "communities", sort, days],
    queryFn: () => fetchCommunities(sort, days),
    enabled: isAuthenticated,
  });

  const communities = data?.communities;

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center bg-background py-12">
        <div className="text-center space-y-6">
          <h1 className="text-2xl font-bold">로그인이 필요합니다</h1>
          <div className="flex gap-4">
            <Button asChild>
              <Link to="/login">로그인</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/signup">회원가입</Link>
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
              커뮤니티 목록을 불러올 수 없습니다
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => refetch()}>다시 시도</Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Globe className="h-8 w-8" />
          커뮤니티 관리
        </h1>
        <p className="text-muted-foreground mt-2">
          전체 커뮤니티 목록 및 활동 현황
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              전체 커뮤니티 ({communities?.length || 0}개)
            </span>
          </CardTitle>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select
                value={sort}
                onValueChange={(v) => setSort(v as SortOption)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activity">활동순</SelectItem>
                  <SelectItem value="members">멤버순</SelectItem>
                  <SelectItem value="created">생성순</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {sort === "activity" && (
              <div className="flex items-center gap-2">
                <Select
                  value={String(days)}
                  onValueChange={(v) => setDays(Number(v))}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">최근 7일</SelectItem>
                    <SelectItem value="30">최근 30일</SelectItem>
                    <SelectItem value="90">최근 90일</SelectItem>
                    <SelectItem value="365">최근 1년</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isFetching && (
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              불러오는 중...
            </div>
          )}
          {!communities || communities.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Globe />
                </EmptyMedia>
                <EmptyTitle>커뮤니티가 없습니다</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>소유자</TableHead>
                  <TableHead className="text-right">멤버</TableHead>
                  <TableHead className="text-right">
                    게시물 ({days}일)
                  </TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>생성일</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {communities.map((community) => {
                  const now = new Date();
                  const starts = new Date(community.starts_at);
                  const ends = new Date(community.ends_at);
                  const isActive = now >= starts && now <= ends;

                  return (
                    <TableRow key={community.id}>
                      <TableCell>
                        <Link
                          to={`/communities/${community.slug}`}
                          className="font-medium hover:underline"
                        >
                          {community.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {community.slug}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {community.owner_login_name || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {community.member_count}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {community.post_count}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {isActive ? (
                            <Badge variant="default">진행중</Badge>
                          ) : now < starts ? (
                            <Badge variant="secondary">예정</Badge>
                          ) : (
                            <Badge variant="outline">종료</Badge>
                          )}
                          {community.is_recruiting && (
                            <Badge variant="secondary">모집중</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(community.created_at).toLocaleDateString(
                          "ko-KR",
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={`https://${community.slug}.${env.domain}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          {community.owner_user_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMasqueradeAndOpen(community)}
                              disabled={masqueradeMutation.isPending}
                            >
                              <LogIn className="h-4 w-4 mr-1" />
                              소유자 전환
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
