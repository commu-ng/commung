import { useQuery } from "@tanstack/react-query";
import { Compass, Hash, Plus, Search, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { CommunityCard } from "~/components/CommunityCard";
import { LoadingState } from "~/components/shared/LoadingState";
import { PageHeader } from "~/components/shared/PageHeader";
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
import { api } from "~/lib/api-client";
import type { Route } from "./+types/communities.ongoing";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "진행 중인 커뮤" },
    { name: "description", content: "진행 중인 커뮤 전체 목록" },
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

async function fetchOngoingCommunities(): Promise<Community[]> {
  const res = await api.console.communities.ongoing.$get();
  if (!res.ok) {
    throw new Error("Failed to fetch ongoing communities");
  }
  const result = await res.json();
  return result.data;
}

export default function OngoingCommunities() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["communities", "ongoing"],
    queryFn: fetchOngoingCommunities,
  });

  const allHashtags = useMemo(() => {
    if (!data || data.length === 0) return [];
    const counts = new Map<string, number>();
    for (const community of data) {
      community.hashtags?.forEach((h) => {
        counts.set(h.tag, (counts.get(h.tag) || 0) + 1);
      });
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
  }, [data]);

  const filtered = useCallback(
    (communities: Community[] | undefined) => {
      if (!communities) return [];
      return communities.filter((community) => {
        const matchesSearch =
          searchQuery === "" ||
          community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          community.slug.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesHashtags =
          selectedHashtags.length === 0 ||
          (community.hashtags &&
            selectedHashtags.every((tag) =>
              community.hashtags?.some((h) => h.tag === tag),
            ));
        return matchesSearch && matchesHashtags;
      });
    },
    [searchQuery, selectedHashtags],
  );

  const visible = useMemo(() => filtered(data), [filtered, data]);

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
          <Button onClick={() => refetch()}>다시 시도</Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <PageHeader
        eyebrow="진행 중"
        icon={Compass}
        tone="lilac"
        title="진행 중인 모든 커뮤"
        description="진행 중인 모든 커뮤를 한 자리에서 둘러봐요."
        actions={
          <Button asChild className="rounded-full">
            <Link to="/communities/create">
              <Plus className="h-4 w-4" />
              커뮤 만들기
            </Link>
          </Button>
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
              {allHashtags.map((hashtag) => (
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

      {visible.length === 0 ? (
        <Empty className="rounded-3xl border border-border/70 bg-card/70 shadow-marsh py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle className="font-display">
              {hasActiveFilters
                ? "검색 결과가 없어요"
                : "진행 중인 커뮤가 없어요"}
            </EmptyTitle>
            <EmptyDescription>
              {hasActiveFilters
                ? "다른 검색어나 해시태그를 시도해보세요."
                : "지금은 진행 중인 커뮤가 없어요."}
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visible.map((community) => (
            <CommunityCard key={community.id} community={community} />
          ))}
        </div>
      )}
    </div>
  );
}
