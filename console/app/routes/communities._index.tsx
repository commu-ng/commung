import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Compass,
  Hash,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { CommunityCard } from "~/components/CommunityCard";
import { PageHeader } from "~/components/shared/PageHeader";
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
import { useAuth } from "~/hooks/useAuth";
import { api } from "~/lib/api-client";
import type { Route } from "./+types/communities._index";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "커뮤 목록" },
    { name: "description", content: "모집 중인 커뮤와 진행 중인 커뮤 목록" },
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

  const isLoading = isLoadingRecruiting || isLoadingOngoing;
  const error = recruitingError || ongoingError;

  const allPublicCommunities = useMemo(() => {
    return [...(recruitingCommunities || []), ...(ongoingCommunities || [])];
  }, [recruitingCommunities, ongoingCommunities]);

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

  const filterCommunities = useCallback(
    (communities: Community[] | undefined) => {
      if (!communities) return [];
      const filtered = communities.filter((community) => {
        const matchesSearch =
          searchQuery === "" ||
          community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          community.slug.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesHashtags =
          selectedHashtags.length === 0 ||
          (community.hashtags &&
            selectedHashtags.every((selectedTag) =>
              community.hashtags?.some((h) => h.tag === selectedTag),
            ));
        return matchesSearch && matchesHashtags;
      });
      // Communities with a banner image surface first; original order is
      // preserved within each bucket via Array.prototype.sort stability.
      return filtered.slice().sort((a, b) => {
        const aHas = a.banner_image_url ? 1 : 0;
        const bHas = b.banner_image_url ? 1 : 0;
        return bHas - aHas;
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

  const hasActiveFilters = searchQuery !== "" || selectedHashtags.length > 0;
  const visibleOngoing = useMemo(() => {
    // When the user is searching/filtering, surface every match. Otherwise
    // hide bannerless ones to keep the discovery view visually rich; the
    // 전체 보기 link below the section opens the full list.
    if (hasActiveFilters) return filteredOngoing;
    return filteredOngoing.filter((c) => c.banner_image_url);
  }, [filteredOngoing, hasActiveFilters]);
  const hiddenOngoingCount = filteredOngoing.length - visibleOngoing.length;

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

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <LoadingState message="커뮤 목록을 불러오는 중..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
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

  const renderGrid = (communities: Community[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {communities.map((community) => (
        <CommunityCard key={community.id} community={community} />
      ))}
    </div>
  );

  const renderEmpty = (label: string, hint: string) => (
    <Empty className="rounded-3xl border border-border/70 bg-card/70 shadow-marsh py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Search />
        </EmptyMedia>
        <EmptyTitle className="font-display">
          {hasActiveFilters ? "검색 결과가 없어요" : label}
        </EmptyTitle>
        <EmptyDescription>
          {hasActiveFilters ? "다른 검색어나 해시태그를 시도해보세요." : hint}
        </EmptyDescription>
      </EmptyHeader>
      {hasActiveFilters && (
        <Button
          variant="outline"
          onClick={clearFilters}
          className="rounded-full"
        >
          필터 초기화
        </Button>
      )}
    </Empty>
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <PageHeader
        eyebrow="커뮤 둘러보기"
        icon={Compass}
        tone="lilac"
        title="마음에 드는 커뮤를 만나봐요"
        description="모집 중인 새 커뮤와 진행 중인 커뮤를 한 자리에서 둘러보세요."
        actions={
          <div className="flex flex-wrap gap-2">
            {isAuthenticated && (
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/communities/mine">
                  <Bookmark className="h-4 w-4" />내 커뮤
                </Link>
              </Button>
            )}
            <Button asChild className="rounded-full">
              <Link to="/communities/create">
                <Plus className="h-4 w-4" />
                커뮤 만들기
              </Link>
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="커뮤 이름이나 주소로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 pr-10 h-11 text-base"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="검색어 지우기"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {allHashtags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {visibleHashtags.map((hashtag) => (
                <Badge
                  key={hashtag}
                  variant={
                    selectedHashtags.includes(hashtag) ? "default" : "outline"
                  }
                  className={`cursor-pointer transition-all ${
                    selectedHashtags.includes(hashtag)
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-marsh"
                      : "hover:bg-accent hover:border-primary/30"
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
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 py-1 rounded-full hover:bg-accent transition-colors"
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
                  className="text-xs text-destructive hover:text-destructive/90 inline-flex items-center gap-1 px-2 py-1 rounded-full hover:bg-destructive/10 transition-colors ml-1"
                >
                  <X className="h-3 w-3" />
                  필터 초기화
                </button>
              )}
            </div>
          )}
        </div>
      </PageHeader>

      <div className="space-y-10">
        <section>
          <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-mint/40 text-mint-ink shadow-marsh">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            모집 중
            <span className="text-xs font-normal text-muted-foreground">
              {filteredRecruiting.length}개
            </span>
          </h2>
          {filteredRecruiting.length === 0
            ? renderEmpty(
                "모집 중인 커뮤가 없어요",
                "새로운 커뮤가 곧 모집을 시작할 예정이에요.",
              )
            : renderGrid(filteredRecruiting)}
        </section>

        <section>
          <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-marsh">
              <Compass className="h-3.5 w-3.5" />
            </span>
            진행 중
            <span className="text-xs font-normal text-muted-foreground">
              {filteredOngoing.length}개
            </span>
          </h2>
          {visibleOngoing.length === 0 && hiddenOngoingCount === 0 ? (
            renderEmpty(
              "진행 중인 커뮤가 없어요",
              "지금은 진행 중인 커뮤가 없어요.",
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleOngoing.map((community) => (
                <CommunityCard key={community.id} community={community} />
              ))}
              {hiddenOngoingCount > 0 && (
                <Link
                  to="/communities/ongoing"
                  className="group relative flex flex-col overflow-hidden rounded-3xl border border-dashed border-border bg-card/40 shadow-marsh transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card hover:shadow-marsh-lg"
                >
                  <div className="relative aspect-[16/9] bg-gradient-to-br from-blossom/30 via-lilac/20 to-mint/20 overflow-hidden flex items-center justify-center">
                    <span className="font-display text-4xl font-bold text-foreground/30 group-hover:text-primary transition-colors">
                      +{hiddenOngoingCount}
                    </span>
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-center">
                    <h3 className="font-display text-xl font-bold text-foreground">
                      더 많은 진행 중 커뮤
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {hiddenOngoingCount}개의 커뮤가 더 있어요
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                      전체 보기
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
