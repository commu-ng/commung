import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Plus, Search } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Separator } from "~/components/ui/separator";
import { api } from "~/lib/api-client";
import { CommunityCard } from "./CommunityCard";
import { LoadingState } from "./shared/LoadingState";

interface Community {
  id: string;
  name: string;
  slug: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  role: string; // API returns string, we'll validate it's one of the expected values
  custom_domain?: string | null;
  domain_verified?: string | null;
  banner_image_url?: string | null;
  banner_image_width?: number | null;
  banner_image_height?: number | null;
  hashtags?: { id: string; tag: string }[];
  pending_application_count?: number;
}

async function fetchMyCommunities(): Promise<Community[]> {
  const res = await api.console.communities.mine.$get();
  if (!res.ok) {
    throw new Error("Failed to fetch communities");
  }
  const json = await res.json();
  return json.data;
}

interface CommunityListProps {
  showHeader?: boolean;
  className?: string;
}

export function CommunityList({
  showHeader = true,
  className = "",
}: CommunityListProps) {
  const {
    data: communities,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["communities", "mine"],
    queryFn: fetchMyCommunities,
  });

  if (isLoading) {
    return (
      <div className={`${className}`}>
        <LoadingState message="커뮤 목록을 불러오는 중..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className}`}>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircle />
            </EmptyMedia>
            <EmptyTitle>오류 발생</EmptyTitle>
            <EmptyDescription>커뮤 목록을 불러올 수 없습니다</EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => refetch()}>다시 시도</Button>
        </Empty>
      </div>
    );
  }

  if (!communities || communities.length === 0) {
    return (
      <div className={`${className}`}>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>커뮤가 없습니다</EmptyTitle>
            <EmptyDescription>
              새로운 커뮤를 만들거나 커뮤를 둘러보세요!
            </EmptyDescription>
          </EmptyHeader>
          <div className="flex flex-col gap-2">
            <Button asChild>
              <Link to="/communities/create">
                <Plus className="mr-2 h-4 w-4" />
                커뮤 개설하기
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/communities">
                <Search className="mr-2 h-4 w-4" />
                커뮤 둘러보기
              </Link>
            </Button>
          </div>
        </Empty>
      </div>
    );
  }

  const now = new Date();

  const activeCommunities = communities.filter((c) => {
    const endDate = new Date(c.ends_at);
    return now <= endDate;
  });

  const finishedCommunities = communities.filter((c) => {
    const endDate = new Date(c.ends_at);
    return now > endDate;
  });

  const ownedCommunities = activeCommunities.filter((c) => c.role === "owner");
  const joinedCommunities = activeCommunities.filter(
    (c) => c.role === "moderator" || c.role === "member",
  );
  const finishedOwnedCommunities = finishedCommunities.filter(
    (c) => c.role === "owner",
  );
  const finishedJoinedCommunities = finishedCommunities.filter(
    (c) => c.role === "moderator" || c.role === "member",
  );

  return (
    <div className={`${className}`}>
      {showHeader && (
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">내 커뮤</h1>
            <p className="text-muted-foreground mt-2">
              총 {communities.length}개 (활성 {activeCommunities.length}개, 종료{" "}
              {finishedCommunities.length}개)
            </p>
          </div>
          <Button asChild>
            <Link to="/communities/create">
              <Plus className="h-4 w-4 mr-2" />
              커뮤 개설하기
            </Link>
          </Button>
        </div>
      )}

      {ownedCommunities.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">내가 만든 커뮤</h2>
          <div className="space-y-4">
            {ownedCommunities.map((community) => (
              <CommunityCard key={community.id} community={community} />
            ))}
          </div>
        </div>
      )}

      {joinedCommunities.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">참여 중인 커뮤</h2>
          <div className="space-y-4">
            {joinedCommunities.map((community) => (
              <CommunityCard key={community.id} community={community} />
            ))}
          </div>
        </div>
      )}

      {(finishedOwnedCommunities.length > 0 ||
        finishedJoinedCommunities.length > 0) && (
        <>
          <Separator className="my-8" />
          <h2 className="text-xl font-semibold mb-4 text-muted-foreground">
            종료된 커뮤
          </h2>

          {finishedOwnedCommunities.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3 text-muted-foreground">
                내가 만든 커뮤
              </h3>
              <div className="space-y-4 opacity-60">
                {finishedOwnedCommunities.map((community) => (
                  <CommunityCard key={community.id} community={community} />
                ))}
              </div>
            </div>
          )}

          {finishedJoinedCommunities.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-3 text-muted-foreground">
                참여했던 커뮤
              </h3>
              <div className="space-y-4 opacity-60">
                {finishedJoinedCommunities.map((community) => (
                  <CommunityCard key={community.id} community={community} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
