import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Crown,
  RefreshCw,
  Search,
  Shield,
  User as UserIcon,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/lib/api-client";
import type { CommunityMember } from "~/types/member";
import { MemberCard } from "./MemberCard";
import { LoadingState } from "./shared/LoadingState";
import type { Role } from "./shared/RoleBadge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

interface CommunityMemberManagementProps {
  communityId: string;
  currentUserRole: Role;
  currentUserId: string;
}

export function CommunityMemberManagement({
  communityId,
  currentUserRole,
  currentUserId,
}: CommunityMemberManagementProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<
    "all" | "owner" | "moderator" | "member"
  >("all");
  const MEMBERS_PER_PAGE = 50;

  // Debounce search query so we don't fire a request per keystroke
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  // Fetch members with infinite query (server-side filtered)
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: [
      "community-members",
      communityId,
      debouncedSearchQuery,
      roleFilter,
    ],
    queryFn: async ({ pageParam = 0 }): Promise<CommunityMember[]> => {
      const query: Record<string, string> = {
        limit: MEMBERS_PER_PAGE.toString(),
        offset: pageParam.toString(),
      };
      if (debouncedSearchQuery) query.q = debouncedSearchQuery;
      if (roleFilter !== "all") query.role = roleFilter;

      const response = await api.console.communities[":id"].members.$get({
        param: { id: communityId },
        query,
      });

      if (!response.ok) {
        throw new Error("멤버 목록을 가져오는데 실패했습니다");
      }

      const result = await response.json();
      return result.data;
    },
    getNextPageParam: (lastPage, allPages) => {
      const totalLoaded = allPages.reduce(
        (total, page) => total + page.length,
        0,
      );
      return lastPage.length < MEMBERS_PER_PAGE ? undefined : totalLoaded;
    },
    initialPageParam: 0,
  });

  const members = useMemo(() => data?.pages.flat() ?? [], [data?.pages]);
  const filteredMembers = members;

  // Infinite scroll trigger
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Scroll event listener for infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop =
        document.documentElement.scrollTop || document.body.scrollTop;
      const scrollHeight =
        document.documentElement.scrollHeight || document.body.scrollHeight;
      const clientHeight =
        document.documentElement.clientHeight || window.innerHeight;

      // Load more when within 200px of the bottom
      if (scrollHeight - scrollTop - clientHeight < 200) {
        loadMore();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadMore]);

  const { data: roleStatsData } = useQuery({
    queryKey: ["community-member-stats", communityId],
    queryFn: async () => {
      const response = await api.console.communities[":id"].members.stats.$get({
        param: { id: communityId },
      });
      if (!response.ok) return { owner: 0, moderator: 0, member: 0 };
      const result = await response.json();
      return result.data;
    },
  });
  const roleStats = roleStatsData ?? { owner: 0, moderator: 0, member: 0 };

  if (!["owner", "moderator"].includes(currentUserRole)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            멤버 관리
          </CardTitle>
          <CardDescription>멤버 관리 권한이 없습니다</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              멤버 관리
            </CardTitle>
            <CardDescription>
              커뮤 멤버들을 관리하고 역할을 변경할 수 있습니다
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            새로고침
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Member Statistics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{members.length}</div>
            <div className="text-sm text-muted-foreground">총 멤버</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Crown className="w-4 h-4 text-destructive" />
              <span className="text-2xl font-bold">{roleStats.owner}</span>
            </div>
            <div className="text-sm text-muted-foreground">소유자</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-2xl font-bold">{roleStats.moderator}</span>
            </div>
            <div className="text-sm text-muted-foreground">모더레이터</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <UserIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{roleStats.member}</span>
            </div>
            <div className="text-sm text-muted-foreground">멤버</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="멤버 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={roleFilter}
            onValueChange={(value) => {
              if (
                value === "all" ||
                value === "owner" ||
                value === "moderator" ||
                value === "member"
              ) {
                setRoleFilter(value);
              }
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">모든 역할</SelectItem>
              <SelectItem value="owner">소유자</SelectItem>
              <SelectItem value="moderator">모더레이터</SelectItem>
              <SelectItem value="member">멤버</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results Info */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {filteredMembers.length}명의 멤버
            {roleFilter !== "all" &&
              ` (${
                roleFilter === "owner"
                  ? "소유자"
                  : roleFilter === "moderator"
                    ? "모더레이터"
                    : "멤버"
              } 필터 적용)`}
            {searchQuery && ` ("${searchQuery}" 검색 결과)`}
          </span>
        </div>

        {/* Error State */}
        {isError && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <AlertCircle />
              </EmptyMedia>
              <EmptyTitle>오류 발생</EmptyTitle>
              <EmptyDescription>
                멤버 목록을 가져오는데 실패했습니다
              </EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" onClick={() => refetch()}>
              다시 시도
            </Button>
          </Empty>
        )}

        {/* Loading State */}
        {isLoading && (
          <LoadingState message="멤버 목록을 불러오는 중..." asCard={false} />
        )}

        {/* Members List */}
        {!isLoading && !isError && (
          <div className="space-y-3">
            {filteredMembers.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Users />
                  </EmptyMedia>
                  <EmptyTitle>
                    {searchQuery || roleFilter !== "all"
                      ? "검색 조건에 맞는 멤버가 없습니다"
                      : "멤버가 없습니다"}
                  </EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                {filteredMembers.map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    communityId={communityId}
                    currentUserRole={currentUserRole}
                    currentUserId={currentUserId}
                    onMemberUpdate={() => refetch()}
                  />
                ))}

                {/* Load more button (works even when scroll detection fails) */}
                {hasNextPage && !isFetchingNextPage && (
                  <div className="mt-4 text-center">
                    <Button
                      variant="outline"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                    >
                      더 보기 ({members.length}명 표시 중)
                    </Button>
                  </div>
                )}

                {/* Loading indicator for infinite scroll */}
                {isFetchingNextPage && (
                  <div className="mt-4">
                    <LoadingState
                      message="더 많은 멤버를 불러오는 중..."
                      asCard={false}
                    />
                  </div>
                )}

                {/* End of content indicator */}
                {!hasNextPage && members.length > 0 && (
                  <div className="bg-background rounded-2xl border border-border p-6 text-center mt-4">
                    <p className="text-muted-foreground text-sm">
                      모든 멤버를 확인했습니다 (총 {members.length}명)
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
