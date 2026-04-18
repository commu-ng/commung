import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Hash, Plus, Search, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { CommunityCard } from "~/components/CommunityCard";
import { LoadingState } from "~/components/shared/LoadingState";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useAuth } from "~/hooks/useAuth";
import { api } from "~/lib/api-client";
import type { Route } from "./+types/communities._index";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "커뮤 목록" },
    {
      name: "description",
      content: "모집 중인 커뮤와 진행 중인 커뮤 목록",
    },
  ];
}

interface Community {
  id: string;
  name: string;
  slug: string;
  starts_at: string;
  ends_at: string;
  is_recruiting: boolean;
  minimum_birth_year: number | null;
  created_at: string;
  custom_domain: string | null;
  domain_verified: string | null;
  owner_profile_id: string | null;
  banner_image_url?: string | null;
  banner_image_width?: number | null;
  banner_image_height?: number | null;
  has_applied?: boolean;
  application_id?: string | null;
  application_status?: string | null;
  is_member?: boolean;
  role?: string | null;
  hashtags?: { id: string; tag: string }[];
  pending_application_count?: number;
}

async function fetchRecruitingCommunities(): Promise<Community[]> {
  const res = await api.console.communities.recruiting.$get();
  if (!res.ok) {
    throw new Error("Failed to fetch recruiting communities");
  }
  const result = await res.json();
  return result.data;
}

async function fetchOngoingCommunities(): Promise<Community[]> {
  const res = await api.console.communities.ongoing.$get();
  if (!res.ok) {
    throw new Error("Failed to fetch ongoing communities");
  }
  const result = await res.json();
  return result.data;
}

async function fetchMyCommunities(): Promise<Community[]> {
  const res = await api.console.communities.mine.$get();
  if (!res.ok) {
    throw new Error("Failed to fetch communities");
  }
  const result = await res.json();
  return result.data;
}

export default function Communities() {
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);
  const [showAllHashtags, setShowAllHashtags] = useState(false);

  const {
    data: recruitingCommunities,
    isLoading: isLoadingRecruiting,
    error: recruitingError,
    refetch: refetchRecruiting,
  } = useQuery({
    queryKey: ["communities", "recruiting"],
    queryFn: fetchRecruitingCommunities,
  });

  const {
    data: ongoingCommunities,
    isLoading: isLoadingOngoing,
    error: ongoingError,
    refetch: refetchOngoing,
  } = useQuery({
    queryKey: ["communities", "ongoing"],
    queryFn: fetchOngoingCommunities,
  });

  const { data: myCommunities, isLoading: isLoadingMine } = useQuery({
    queryKey: ["communities", "mine"],
    queryFn: fetchMyCommunities,
    enabled: isAuthenticated,
  });

  const isLoading = isLoadingRecruiting || isLoadingOngoing;
  const error = recruitingError || ongoingError;

  // Combine all public communities for hashtag extraction
  const allPublicCommunities = useMemo(() => {
    return [...(recruitingCommunities || []), ...(ongoingCommunities || [])];
  }, [recruitingCommunities, ongoingCommunities]);

  // Get top hashtags from all communities
  const allHashtags = useMemo(() => {
    if (allPublicCommunities.length === 0) return [];

    const hashtagCounts = new Map<string, number>();
    allPublicCommunities.forEach((community) => {
      community.hashtags?.forEach((hashtag) => {
        hashtagCounts.set(
          hashtag.tag,
          (hashtagCounts.get(hashtag.tag) || 0) + 1,
        );
      });
    });

    return Array.from(hashtagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0]);
  }, [allPublicCommunities]);

  const visibleHashtags = showAllHashtags
    ? allHashtags
    : allHashtags.slice(0, 10);

  // Filter function for search and hashtags
  const filterCommunities = useCallback(
    (communities: Community[] | undefined) => {
      if (!communities) return [];

      return communities.filter((community) => {
        // Search filter
        const matchesSearch =
          searchQuery === "" ||
          community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          community.slug.toLowerCase().includes(searchQuery.toLowerCase());

        // Hashtag filter
        const matchesHashtags =
          selectedHashtags.length === 0 ||
          (community.hashtags &&
            selectedHashtags.every((selectedTag) =>
              community.hashtags?.some(
                (hashtag) => hashtag.tag === selectedTag,
              ),
            ));

        return matchesSearch && matchesHashtags;
      });
    },
    [searchQuery, selectedHashtags],
  );

  const filteredRecruiting = useMemo(
    () => filterCommunities(recruitingCommunities),
    [filterCommunities, recruitingCommunities],
  );

  const filteredOngoing = useMemo(
    () => filterCommunities(ongoingCommunities),
    [filterCommunities, ongoingCommunities],
  );

  const filteredMine = useMemo(
    () => filterCommunities(myCommunities),
    [filterCommunities, myCommunities],
  );

  const toggleHashtag = (hashtag: string) => {
    setSelectedHashtags((prev) =>
      prev.includes(hashtag)
        ? prev.filter((h) => h !== hashtag)
        : [...prev, hashtag],
    );
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedHashtags([]);
  };

  const hasActiveFilters = searchQuery !== "" || selectedHashtags.length > 0;

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <LoadingState message="커뮤 목록을 불러오는 중..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Empty>
          <EmptyHeader>
            <EmptyTitle className="text-destructive">오류 발생</EmptyTitle>
            <EmptyDescription>커뮤 목록을 불러올 수 없습니다</EmptyDescription>
          </EmptyHeader>
          <Button
            onClick={() => {
              refetchRecruiting();
              refetchOngoing();
            }}
          >
            다시 시도
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">커뮤 목록</h1>
        </div>
        <Button asChild>
          <Link to="/communities/create">
            <Plus className="h-4 w-4 mr-2" />
            커뮤 만들기
          </Link>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="커뮤 이름으로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Hashtag Filter */}
      {allHashtags.length > 0 && (
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            {visibleHashtags.map((hashtag) => (
              <Badge
                key={hashtag}
                variant={
                  selectedHashtags.includes(hashtag) ? "default" : "outline"
                }
                className={`cursor-pointer transition-colors ${
                  selectedHashtags.includes(hashtag)
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                    : "hover:bg-accent"
                }`}
                onClick={() => toggleHashtag(hashtag)}
              >
                <Hash className="h-3 w-3 mr-1" />
                {hashtag}
              </Badge>
            ))}
            {allHashtags.length > 10 && (
              <button
                type="button"
                onClick={() => setShowAllHashtags(!showAllHashtags)}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {showAllHashtags ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    접기
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />+
                    {allHashtags.length - 10}개 더보기
                  </>
                )}
              </button>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm text-destructive hover:text-destructive/90 flex items-center gap-1 ml-2"
              >
                <X className="h-3 w-3" />
                필터 초기화
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="recruiting" className="w-full">
        <TabsList className="w-full justify-start mb-6">
          <TabsTrigger value="recruiting" className="flex-1 sm:flex-none">
            모집 중
            <span className="ml-1.5 text-xs bg-mint/40 text-mint-ink px-1.5 py-0.5 rounded-full">
              {filteredRecruiting.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="ongoing" className="flex-1 sm:flex-none">
            진행 중
            <span className="ml-1.5 text-xs bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">
              {filteredOngoing.length}
            </span>
          </TabsTrigger>
          {isAuthenticated && (
            <TabsTrigger value="mine" className="flex-1 sm:flex-none">
              내 커뮤
              <span className="ml-1.5 text-xs bg-blossom/40 text-blossom-ink px-1.5 py-0.5 rounded-full">
                {isLoadingMine ? "..." : filteredMine.length}
              </span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="recruiting">
          {filteredRecruiting.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search />
                </EmptyMedia>
                <EmptyTitle>
                  {hasActiveFilters
                    ? "검색 결과가 없습니다"
                    : "모집 중인 커뮤가 없습니다"}
                </EmptyTitle>
                <EmptyDescription>
                  {hasActiveFilters
                    ? "다른 검색어나 해시태그를 시도해보세요."
                    : "새로운 커뮤가 곧 모집을 시작할 예정입니다."}
                </EmptyDescription>
              </EmptyHeader>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  필터 초기화
                </Button>
              )}
            </Empty>
          ) : (
            <div className="space-y-4">
              {filteredRecruiting.map((community) => (
                <CommunityCard key={community.id} community={community} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ongoing">
          {filteredOngoing.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search />
                </EmptyMedia>
                <EmptyTitle>
                  {hasActiveFilters
                    ? "검색 결과가 없습니다"
                    : "진행 중인 커뮤가 없습니다"}
                </EmptyTitle>
                <EmptyDescription>
                  {hasActiveFilters
                    ? "다른 검색어나 해시태그를 시도해보세요."
                    : "현재 진행 중인 커뮤가 없습니다."}
                </EmptyDescription>
              </EmptyHeader>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  필터 초기화
                </Button>
              )}
            </Empty>
          ) : (
            <div className="space-y-4">
              {filteredOngoing.map((community) => (
                <CommunityCard key={community.id} community={community} />
              ))}
            </div>
          )}
        </TabsContent>

        {isAuthenticated && (
          <TabsContent value="mine">
            {isLoadingMine ? (
              <LoadingState message="내 커뮤를 불러오는 중..." />
            ) : filteredMine.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Search />
                  </EmptyMedia>
                  <EmptyTitle>
                    {hasActiveFilters
                      ? "검색 결과가 없습니다"
                      : "참여 중인 커뮤가 없습니다"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {hasActiveFilters
                      ? "다른 검색어나 해시태그를 시도해보세요."
                      : "새로운 커뮤를 만들거나 커뮤를 둘러보세요!"}
                  </EmptyDescription>
                </EmptyHeader>
                {hasActiveFilters ? (
                  <Button variant="outline" onClick={clearFilters}>
                    필터 초기화
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button asChild>
                      <Link to="/communities/create">
                        <Plus className="h-4 w-4 mr-2" />
                        커뮤 만들기
                      </Link>
                    </Button>
                  </div>
                )}
              </Empty>
            ) : (
              <div className="space-y-4">
                {filteredMine.map((community) => (
                  <CommunityCard key={community.id} community={community} />
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
